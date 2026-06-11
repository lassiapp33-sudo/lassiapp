-- ===========================================================================
-- LASSİ — "Offre du quartier" : panneau publicitaire payant + don admin
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ===========================================================================

-- ─── 1. Produit annoncé dans "Offre du quartier" (don admin OU abonnement payé) ──

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS featured_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- ─── 2. Produit choisi par le marchand au moment du paiement ────────────────

ALTER TABLE visibility_subscriptions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- ─── 3. Durée en jours — remplace duration_months pour le calcul d'expiration ──
-- (nécessaire car le forfait "2 semaines" n'est pas un nombre entier de mois)

ALTER TABLE visibility_plans
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;

UPDATE visibility_plans SET duration_days = 30  WHERE id = '1m' AND duration_days IS NULL;
UPDATE visibility_plans SET duration_days = 90  WHERE id = '3m' AND duration_days IS NULL;
UPDATE visibility_plans SET duration_days = 180 WHERE id = '6m' AND duration_days IS NULL;

-- Nouveau forfait "2 semaines" (duration_months = 0 → trié en premier)
INSERT INTO visibility_plans (id, label, price, duration_months, duration_days, old_price, per_label, popular)
VALUES ('2sem', '2 semaines', 1000, 0, 14, NULL, 'par 2 semaines', FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE visibility_plans ALTER COLUMN duration_days SET NOT NULL;

-- ─── 3bis. Baisse tarifaire "Offre du quartier" ────────────────────────────────
-- 2sem: 6 000 → 1 000 F | 1m: 10 000 → 3 000 F
-- 3m: 24 000 → 5 000 F (barré 9 000 = 3 mois au tarif 1m, soit 1 667 F/mois)
-- 6m: 42 000 → 9 000 F (barré 18 000 = 6 mois au tarif 1m, soit 1 500 F/mois)

UPDATE visibility_plans SET price = 1000 WHERE id = '2sem';
UPDATE visibility_plans SET price = 3000 WHERE id = '1m';
UPDATE visibility_plans SET price = 5000, old_price = 9000,  per_label = '1 667 F/mois' WHERE id = '3m';
UPDATE visibility_plans SET price = 9000, old_price = 18000, per_label = '1 500 F/mois' WHERE id = '6m';

-- ─── 4. shops_effective : is_effectively_featured couvre aussi is_featured ──────
-- DROP + CREATE car l'ajout de featured_product_id à shops décale les colonnes
-- calculées et CREATE OR REPLACE échoue dans ce cas (cf. vip_system_v2).
-- WITH (security_invoker = on) pour préserver le correctif de
-- 20260610020000_section2_shops_effective_invoker.sql (la vue n'est pas
-- recréée en SECURITY DEFINER).

DROP VIEW IF EXISTS shops_effective CASCADE;
CREATE VIEW shops_effective WITH (security_invoker = on) AS
  SELECT
    s.*,
    (
      (s.is_vip = TRUE OR (s.vip_manual = TRUE AND (s.vip_manual_until IS NULL OR s.vip_manual_until > NOW())))
      AND s.vip_exclu = FALSE
    ) AS is_effectively_vip,
    (
      s.is_featured = TRUE
      OR (
        s.featured_manual = TRUE
        AND (s.featured_manual_until IS NULL OR s.featured_manual_until > NOW())
      )
    ) AS is_effectively_featured
  FROM shops s;

-- ─── 5. expire_visibility_subscriptions : nettoyer featured_product_id ─────────
-- Ne désactive le produit annoncé que s'il correspond à l'abonnement qui expire,
-- pour ne jamais écraser un produit mis en avant via un don admin actif.

CREATE OR REPLACE FUNCTION expire_visibility_subscriptions()
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

  UPDATE shops s
  SET    is_featured = FALSE,
         featured_product_id = NULL
  FROM   visibility_subscriptions vs
  WHERE  vs.shop_id = s.id
    AND  vs.status = 'expired'
    AND  vs.expires_at >= NOW() - INTERVAL '1 day'
    AND  (s.featured_product_id IS NULL OR s.featured_product_id = vs.product_id);
END;
$$;

-- ─── 6. Étendre shops_protect_vip_fields aux champs "Offre du quartier" ────────
-- shops_update_own ("USING (merchant_id = auth.uid())", sans restriction de
-- colonnes) permet à un marchand de PATCH n'importe quelle colonne de SA propre
-- ligne shops via l'API REST. Le trigger shops_vip_protect (vip_system_v2) ne
-- restaurait que les champs VIP — un marchand pouvait donc s'auto-attribuer
-- "Offre du quartier" gratuitement et indéfiniment (is_featured/featured_manual/
-- featured_manual_until), et même y afficher le produit d'une AUTRE boutique
-- (featured_product_id, dont la FK ne vérifie que l'existence du produit, pas
-- son propriétaire). On élargit le même trigger pour protéger ces champs.

CREATE OR REPLACE FUNCTION shops_protect_vip_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jwt_role TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  v_jwt_role := auth.role();

  -- Appels directs DB (pg_cron, migrations, SECURITY DEFINER functions) → autorisés
  IF v_jwt_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- service_role JWT (Edge Functions admin) → autorisé
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Utilisateur authentifié : vérifier s'il est admin
  IF v_jwt_role = 'authenticated' AND auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin
    FROM profiles WHERE id = auth.uid();
    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tous les autres : restaurer silencieusement les champs protégés
  NEW.is_vip                 := OLD.is_vip;
  NEW.vip_exclu              := OLD.vip_exclu;
  NEW.vip_manual             := OLD.vip_manual;
  NEW.vip_manual_until       := OLD.vip_manual_until;
  NEW.is_featured            := OLD.is_featured;
  NEW.featured_manual        := OLD.featured_manual;
  NEW.featured_manual_until  := OLD.featured_manual_until;
  NEW.featured_product_id    := OLD.featured_product_id;
  NEW.manual_note            := OLD.manual_note;

  RETURN NEW;
END;
$$;
