-- ===========================================================================
-- LASSI — Rollback complet avis v2
-- Annule : avis_v2_idempotent + avis_antifraude + avis_column_guard
--          + can_leave_avis_rpc
-- ⚠️  Restaure l'ancienne politique INSERT (sans vérification de commande).
-- ⚠️  Les avis supprimés par avis_antifraude NE SONT PAS restaurés.
-- ===========================================================================

DO $$
BEGIN

  -- ─── 1. Supprimer le trigger de garde colonnes ────────────────────────────
  DROP TRIGGER IF EXISTS trg_avis_column_guard ON avis;
  DROP FUNCTION IF EXISTS fn_avis_column_guard();
  RAISE NOTICE '[rollback] Trigger/fonction fn_avis_column_guard supprimés ✓';

  -- ─── 2. Supprimer la RPC can_leave_avis ──────────────────────────────────
  DROP FUNCTION IF EXISTS can_leave_avis(UUID);
  RAISE NOTICE '[rollback] Fonction can_leave_avis supprimée ✓';

  -- ─── 3. Revenir à l'ancienne politique INSERT (sans vérif commande) ───────
  DROP POLICY IF EXISTS "avis_insert" ON avis;
  CREATE POLICY "avis_insert"
    ON avis FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);
  RAISE NOTICE '[rollback] Politique avis_insert restaurée (sans anti-fraude) ✓';

  -- ─── 4. Supprimer UNIQUE (shop_id, author_id) ────────────────────────────
  DROP INDEX IF EXISTS avis_shop_id_author_id_key;
  RAISE NOTICE '[rollback] Index UNIQUE(shop_id, author_id) supprimé ✓';

  -- ─── 5. Restaurer UNIQUE (order_id) ──────────────────────────────────────
  -- Uniquement si la colonne order_id existe et n'a pas de contrainte UNIQUE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'avis' AND constraint_name = 'avis_order_id_key'
  ) THEN
    -- Nettoyer les doublons éventuels avant de recréer la contrainte
    DELETE FROM avis a
    WHERE id <> (
      SELECT id FROM avis b
      WHERE b.order_id = a.order_id
      ORDER BY b.created_at ASC
      LIMIT 1
    )
    AND order_id IS NOT NULL;
    ALTER TABLE avis ADD CONSTRAINT avis_order_id_key UNIQUE (order_id);
    RAISE NOTICE '[rollback] Contrainte UNIQUE(order_id) restaurée ✓';
  ELSE
    RAISE NOTICE '[rollback] Contrainte UNIQUE(order_id) déjà présente (skip)';
  END IF;

  -- ─── 6. Restaurer FK order_id → ON DELETE CASCADE ────────────────────────
  ALTER TABLE avis DROP CONSTRAINT IF EXISTS avis_order_id_fkey;
  ALTER TABLE avis
    ADD CONSTRAINT avis_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  RAISE NOTICE '[rollback] FK order_id → ON DELETE CASCADE restaurée ✓';

  -- ─── 7. Remettre order_id NOT NULL ───────────────────────────────────────
  -- ⚠️  Ne pas faire si des lignes ont order_id = NULL
  IF EXISTS (SELECT 1 FROM avis WHERE order_id IS NULL) THEN
    RAISE WARNING '[rollback] Des avis ont order_id = NULL → SET NOT NULL ignoré. Nettoyez manuellement.';
  ELSE
    ALTER TABLE avis ALTER COLUMN order_id SET NOT NULL;
    RAISE NOTICE '[rollback] order_id remis NOT NULL ✓';
  END IF;

  RAISE NOTICE '[rollback] Rollback terminé.';

END $$;
