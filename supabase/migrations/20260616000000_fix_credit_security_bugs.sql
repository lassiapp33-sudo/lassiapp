-- ===========================================================================
-- LASSİ — Correctifs sécurité crédit LASSI (ultrareview 2026-06-16)
--
-- 1) expire_visibility_subscriptions : remet featured_product_ids et
--    featured_all_products à zéro à l'expiration (les migrations précédentes
--    ne remettaient que is_featured et featured_product_id). Sans ce correctif,
--    les requêtes SQL directes sur shops (hors shops_effective) voient encore
--    des métadonnées périmées après expiration.
--
-- 2) spend_shop_credit / increment_shop_credit / decrement_shop_credit_clamped :
--    validation p_amount > 0. Un montant nul ou négatif ne doit jamais modifier
--    le solde (un bug de calcul de prix pourrait sinon créditer au lieu de débiter).
--
-- 3) increment_shop_credit : retourne une exception si shop_id inexistant,
--    plutôt que NULL silencieux, pour que les appelants (admin-attribuer-recompense)
--    détectent les cas TOCTOU boutique-supprimée.
--
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor, APRÈS
-- 20260614010000_schedule_expire_visibility_cron.sql.
-- ===========================================================================

-- ─── 1. expire_visibility_subscriptions : réinitialisation complète ─────────
-- Ajoute la remise à zéro de featured_product_ids et featured_all_products
-- pour que les données shops soient cohérentes sans passer par shops_effective.

CREATE OR REPLACE FUNCTION public.expire_visibility_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE visibility_subscriptions
  SET    status = 'expired'
  WHERE  status = 'active'
    AND  expires_at < NOW();

  -- Retirer la mise en avant de toute boutique dont AUCUN abonnement actif
  -- n'est en cours. On ne filtre pas sur un abonnement expiré spécifique
  -- pour éviter deux classes de bugs :
  --   a) Une boutique avec un abonnement expiré + un nouveau actif perdrait
  --      sa mise en avant (pas de NOT EXISTS dans l'ancienne version).
  --   b) La fenêtre glissante 1 jour laissait les boutiques featurd pour
  --      toujours si le cron était en panne plus de 24 h.
  UPDATE shops
  SET    is_featured            = FALSE,
         featured_product_id    = NULL,
         featured_product_ids   = '{}',
         featured_all_products  = FALSE
  WHERE  is_featured = TRUE
    AND  NOT EXISTS (
           SELECT 1 FROM visibility_subscriptions act
           WHERE  act.shop_id   = shops.id
             AND  act.status    = 'active'
             AND  act.expires_at > NOW()
         );
END;
$$;

-- ─── 2. spend_shop_credit : validation p_amount > 0 ────────────────────────

CREATE OR REPLACE FUNCTION public.spend_shop_credit(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'spend_shop_credit: p_amount doit être > 0, reçu %', p_amount;
  END IF;

  UPDATE shops
  SET    credit_balance = credit_balance - p_amount
  WHERE  id = p_shop_id
    AND  credit_balance >= p_amount
  RETURNING credit_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ─── 3. increment_shop_credit : validation p_amount > 0 + erreur si boutique introuvable ──
-- Retourne une exception si le shop_id ne correspond à aucune ligne — permet
-- aux appelants (admin-attribuer-recompense) de détecter les cas TOCTOU où la
-- boutique a été supprimée entre le lookup et le crédit.

CREATE OR REPLACE FUNCTION public.increment_shop_credit(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_shop_credit: p_amount doit être > 0, reçu %', p_amount;
  END IF;

  UPDATE shops
  SET    credit_balance = credit_balance + p_amount
  WHERE  id = p_shop_id
  RETURNING credit_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'increment_shop_credit: boutique introuvable (shop_id = %)', p_shop_id;
  END IF;

  RETURN v_new_balance;
END;
$$;

-- ─── 4. decrement_shop_credit_clamped : validation p_amount > 0 ────────────

CREATE OR REPLACE FUNCTION public.decrement_shop_credit_clamped(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_shop_credit_clamped: p_amount doit être > 0, reçu %', p_amount;
  END IF;

  UPDATE shops
  SET    credit_balance = GREATEST(0, credit_balance - p_amount)
  WHERE  id = p_shop_id
  RETURNING credit_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'decrement_shop_credit_clamped: boutique introuvable (shop_id = %)', p_shop_id;
  END IF;

  RETURN v_new_balance;
END;
$$;

-- Les REVOKE/GRANT sont déjà en place depuis 20260613030000 — pas besoin de les répéter.

NOTIFY pgrst, 'reload schema';
