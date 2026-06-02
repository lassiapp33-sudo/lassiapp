-- ============================================================
-- LASSI — Système de réputation automatique des prestataires
-- Déclenché par les vraies commandes validées via l'app
-- SAFE à re-exécuter
-- ============================================================

-- ─── 1. COLONNES SHOPS ────────────────────────────────────────────────────────

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS orders_count       INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interactions_count INTEGER       NOT NULL DEFAULT 0;

-- rating mis à 0 par défaut (plus de 4.5 fictif)
ALTER TABLE shops ALTER COLUMN rating SET DEFAULT 0;
UPDATE shops SET rating = 0 WHERE orders_count = 0 AND reviews_count = 0;

-- ─── 2. FONCTION DE CALCUL DU RATING ─────────────────────────────────────────
--
-- Formule :
--   • 0 commande + 0 avis → 0 (badge "Nouveau" ou "Établi" selon l'âge)
--   • Commandes uniquement → 3.3 + LN(orders + 1) × 0.3, plafonné à 4.2
--     Ex : 1 cmd → 3.5  |  5 cmd → 3.8  |  10 cmd → 4.0  |  25+ → 4.2
--   • Avec vrais avis (future) → 40 % commandes + 60 % note moyenne, plafonné à 5.0
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_shop_rating(
  p_orders  INTEGER,
  p_reviews INTEGER,
  p_avg     FLOAT DEFAULT 0
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  base FLOAT;
BEGIN
  IF p_orders = 0 AND p_reviews = 0 THEN
    RETURN 0;
  END IF;

  -- Réputation basée sur les commandes validées (plafond 4.2 sans avis)
  base := LEAST(4.2, 3.3 + LN(p_orders::FLOAT + 1) * 0.3);

  IF p_reviews > 0 THEN
    -- Pondération : 40 % activité commandes + 60 % note moyenne réelle
    RETURN LEAST(5.0, base * 0.4 + p_avg * 0.6);
  END IF;

  RETURN base;
END;
$$;

-- ─── 3. TRIGGER : ORDER → DONE ───────────────────────────────────────────────
--
-- Quand un prestataire passe une commande à 'done' (validée/livrée) :
--   • orders_count + 1
--   • rating recalculé automatiquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_increment_shop_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Transition vers 'done' uniquement (pas de doublon si re-trigger)
  IF NEW.status = 'done' AND (OLD IS NULL OR OLD.status <> 'done') THEN
    UPDATE shops
    SET
      orders_count = orders_count + 1,
      -- rating recalculé avec le NOUVEAU orders_count (orders_count + 1 = current value après UPDATE)
      rating = compute_shop_rating(
        orders_count + 1,
        reviews_count,
        CASE WHEN reviews_count > 0 THEN rating ELSE 0 END
      )
    WHERE id = NEW.shop_id;
  END IF;

  -- Si annulation d'une commande déjà validée → décrémente
  IF OLD.status = 'done' AND NEW.status = 'refused' THEN
    UPDATE shops
    SET
      orders_count = GREATEST(0, orders_count - 1),
      rating = compute_shop_rating(
        GREATEST(0, orders_count - 1),
        reviews_count,
        CASE WHEN reviews_count > 0 THEN rating ELSE 0 END
      )
    WHERE id = NEW.shop_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger si existant, puis recréer
DROP TRIGGER IF EXISTS trg_order_done ON orders;

CREATE TRIGGER trg_order_done
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_shop_orders();

-- ─── 4. TRIGGER : INTERACTION CLIENT ─────────────────────────────────────────
--
-- Chaque nouvelle commande placée (peu importe le statut initial)
-- incrémente interactions_count — mesure l'attractivité du prestataire.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_increment_shop_interactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shops
  SET interactions_count = interactions_count + 1
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_order_interaction ON orders;

CREATE TRIGGER trg_new_order_interaction
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_shop_interactions();

-- ─── 5. RECALCUL DES BOUTIQUES EXISTANTES ────────────────────────────────────
-- Resynchronise les boutiques qui ont déjà des commandes 'done' en base

UPDATE shops s
SET
  orders_count = (
    SELECT COUNT(*) FROM orders o
    WHERE o.shop_id = s.id AND o.status = 'done'
  ),
  interactions_count = (
    SELECT COUNT(*) FROM orders o
    WHERE o.shop_id = s.id AND o.status <> 'refused'
  );

UPDATE shops
SET rating = compute_shop_rating(orders_count, reviews_count, 0)
WHERE orders_count > 0 OR reviews_count > 0;

-- ─── 6. RECHARGER LE SCHEMA CACHE ────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
