-- ===========================================================================
-- LASSI — Migration avis v2 : idempotente, loggée, testée sur DB existante
-- Regroupe toutes les modifications structurelles avis en un seul script.
-- Chaque étape vérifie l'état actuel avant d'agir → SAFE à re-exécuter N fois.
-- ===========================================================================

DO $$
DECLARE
  v_col_nullable  BOOLEAN;
  v_fk_action     TEXT;
  v_has_old_uq    BOOLEAN;
  v_has_new_uq    BOOLEAN;
  v_has_old_idx   BOOLEAN;
BEGIN

  -- ─── ÉTAPE 1 : order_id nullable ─────────────────────────────────────────

  SELECT (is_nullable = 'YES')
    INTO v_col_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'avis'
    AND column_name  = 'order_id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table avis ou colonne order_id introuvable.';
  END IF;

  IF NOT v_col_nullable THEN
    ALTER TABLE avis ALTER COLUMN order_id DROP NOT NULL;
    RAISE NOTICE '[avis v2] Étape 1 : order_id rendu nullable ✓';
  ELSE
    RAISE NOTICE '[avis v2] Étape 1 : order_id déjà nullable (skip)';
  END IF;

  -- ─── ÉTAPE 2 : FK order_id → ON DELETE SET NULL ───────────────────────────

  SELECT rc.delete_rule
    INTO v_fk_action
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = rc.constraint_name
  WHERE kcu.table_name   = 'avis'
    AND kcu.column_name  = 'order_id'
    AND kcu.table_schema = 'public';

  IF NOT FOUND OR v_fk_action <> 'SET NULL' THEN
    ALTER TABLE avis DROP CONSTRAINT IF EXISTS avis_order_id_fkey;
    ALTER TABLE avis
      ADD CONSTRAINT avis_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
    RAISE NOTICE '[avis v2] Étape 2 : FK order_id → SET NULL ✓';
  ELSE
    RAISE NOTICE '[avis v2] Étape 2 : FK déjà SET NULL (skip)';
  END IF;

  -- ─── ÉTAPE 3 : supprimer UNIQUE (order_id) ───────────────────────────────

  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name       = 'avis'
      AND constraint_name  = 'avis_order_id_key'
      AND constraint_type  = 'UNIQUE'
  ) INTO v_has_old_uq;

  IF v_has_old_uq THEN
    ALTER TABLE avis DROP CONSTRAINT avis_order_id_key;
    RAISE NOTICE '[avis v2] Étape 3 : UNIQUE(order_id) supprimé ✓';
  ELSE
    RAISE NOTICE '[avis v2] Étape 3 : UNIQUE(order_id) absent (skip)';
  END IF;

  -- ─── ÉTAPE 4 : créer UNIQUE (shop_id, author_id) ─────────────────────────

  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'avis'
      AND indexname = 'avis_shop_id_author_id_key'
  ) INTO v_has_new_uq;

  IF NOT v_has_new_uq THEN
    CREATE UNIQUE INDEX avis_shop_id_author_id_key ON avis (shop_id, author_id);
    RAISE NOTICE '[avis v2] Étape 4 : UNIQUE(shop_id, author_id) créé ✓';
  ELSE
    RAISE NOTICE '[avis v2] Étape 4 : UNIQUE(shop_id, author_id) déjà présent (skip)';
  END IF;

  -- ─── ÉTAPE 5 : supprimer idx_avis_order_id ───────────────────────────────

  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'avis'
      AND indexname = 'idx_avis_order_id'
  ) INTO v_has_old_idx;

  IF v_has_old_idx THEN
    DROP INDEX idx_avis_order_id;
    RAISE NOTICE '[avis v2] Étape 5 : idx_avis_order_id supprimé ✓';
  ELSE
    RAISE NOTICE '[avis v2] Étape 5 : idx_avis_order_id absent (skip)';
  END IF;

  RAISE NOTICE '[avis v2] Migration terminée sans erreur.';

END $$;

-- ===========================================================================
-- ROLLBACK → voir avis_v2_rollback.sql
-- ===========================================================================
