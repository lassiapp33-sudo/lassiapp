-- ===========================================================================
-- LASSİ — Correctifs post-review "Offre du Quartier / crédit LASSI"
-- (ultrareview 2026-06-13, commits 29790db..8110eec)
--
-- 1) pay_method CHECK : autoriser 'credit' — sans ce fix, TOUT achat
--    "Offre du Quartier" payé en crédit LASSI débite le portefeuille
--    (spend_shop_credit, déjà committé) puis échoue sur l'INSERT
--    visibility_subscriptions → le marchand perd son crédit à 100%.
-- 2) Index unique partiel (shop_id) WHERE status='active' : empêche un
--    double-clic/retry de créer deux abonnements actifs et de débiter
--    le crédit deux fois (TOCTOU sur le check existant ligne 131-139).
-- 3) decrement_shop_credit_clamped : permet à admin-attribuer-recompense
--    de retirer le crédit déjà transféré lors d'une révocation.
-- 4) handle_new_auth_user : NULLIF au lieu de COALESCE('') pour phone —
--    sinon profiles_phone_format_check casse toute création de compte
--    sans téléphone (Dashboard "Add user", futur OAuth/email-only).
-- 5) REVOKE/GRANT service_role sur les RPC crédit/boost — durcissement
--    cohérent avec le reste du projet (payout_queue_*, process_refund...).
-- ===========================================================================

-- ─── 1. pay_method : autoriser 'credit' ────────────────────────────────────

ALTER TABLE visibility_subscriptions
  DROP CONSTRAINT IF EXISTS visibility_subscriptions_pay_method_check;

ALTER TABLE visibility_subscriptions
  ADD CONSTRAINT visibility_subscriptions_pay_method_check
  CHECK (pay_method IN ('wave', 'orange_money', 'credit'));

-- ─── 2. Un seul abonnement actif par boutique ──────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_vissub_shop_active_unique
  ON visibility_subscriptions (shop_id)
  WHERE status = 'active';

-- ─── 3. decrement_shop_credit_clamped : retrait de crédit (révocation) ─────

CREATE OR REPLACE FUNCTION decrement_shop_credit_clamped(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE shops
  SET    credit_balance = GREATEST(0, credit_balance - p_amount)
  WHERE  id = p_shop_id
  RETURNING credit_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ─── 4. handle_new_auth_user : phone vide -> NULL (pas '') ─────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, auth_email, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Utilisateur'),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'real_email', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ─── 5. Durcissement REVOKE/GRANT — RPC crédit/boost service_role only ─────

REVOKE EXECUTE ON FUNCTION public.increment_shop_credit(uuid, int)         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_shop_credit(uuid, int)         TO service_role;

REVOKE EXECUTE ON FUNCTION public.spend_shop_credit(uuid, int)             FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.spend_shop_credit(uuid, int)             TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_shop_credit_clamped(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrement_shop_credit_clamped(uuid, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.grant_recherche_boost(uuid, int)         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_recherche_boost(uuid, int)         TO service_role;

REVOKE EXECUTE ON FUNCTION public.grant_carte_pin(uuid, int)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_carte_pin(uuid, int)               TO service_role;
