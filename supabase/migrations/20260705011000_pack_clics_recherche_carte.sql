-- ─── Tables de clics pour les packs Recherche et Épingle dorée ───────────────
-- Même principe que carrousel_clics (20260705000000) : pas de UNIQUE,
-- chaque clic client est une ligne indépendante.

-- Pack "Booster ma position dans les recherches"
CREATE TABLE IF NOT EXISTS recherche_clics (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id)       ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recherche_clics_shop_idx
  ON recherche_clics(shop_id, clicked_at);

ALTER TABLE recherche_clics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_insert_own_click" ON recherche_clics;
CREATE POLICY "client_insert_own_click" ON recherche_clics
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Pack "Épingle dorée (carte)"
CREATE TABLE IF NOT EXISTS carte_clics (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id)       ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carte_clics_shop_idx
  ON carte_clics(shop_id, clicked_at);

ALTER TABLE carte_clics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_insert_own_click" ON carte_clics;
CREATE POLICY "client_insert_own_click" ON carte_clics
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- ─── Mise à jour du RPC get_shop_visibility_stats ─────────────────────────────

CREATE OR REPLACE FUNCTION get_shop_visibility_stats(
  p_shop_id    UUID,
  p_offer_type TEXT DEFAULT 'quartier'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id    UUID;
  v_started_at     TIMESTAMPTZ;
  v_month_start    TIMESTAMPTZ := date_trunc('month', NOW());
  v_views_month    BIGINT := 0;
  v_visits_since   BIGINT := 0;
  v_orders_month   BIGINT := 0;
  v_revenue_month  BIGINT := 0;
BEGIN
  -- 1. Vérifier que l'appelant est bien le marchand de cette boutique
  SELECT merchant_id INTO v_merchant_id
  FROM shops WHERE id = p_shop_id;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable';
  END IF;

  IF v_merchant_id <> auth.uid() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- 2. Date de début de l'abonnement actif pour ce pack
  SELECT started_at INTO v_started_at
  FROM visibility_subscriptions
  WHERE shop_id    = p_shop_id
    AND status     = 'active'
    AND offer_type = p_offer_type
  ORDER BY started_at DESC
  LIMIT 1;

  -- Fallback : début du mois courant
  IF v_started_at IS NULL THEN
    v_started_at := v_month_start;
  END IF;

  -- 3. Visiteurs uniques ce mois (recently_viewed)
  SELECT COUNT(*) INTO v_views_month
  FROM recently_viewed
  WHERE shop_id  = p_shop_id
    AND viewed_at >= v_month_start;

  -- 4. Clics depuis le pack (table selon offer_type)
  IF p_offer_type = 'quartier' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM carrousel_clics
    WHERE shop_id  = p_shop_id AND clicked_at >= v_started_at;

  ELSIF p_offer_type = 'recherche' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM recherche_clics
    WHERE shop_id  = p_shop_id AND clicked_at >= v_started_at;

  ELSIF p_offer_type = 'carte' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM carte_clics
    WHERE shop_id  = p_shop_id AND clicked_at >= v_started_at;
  END IF;

  -- 5. Commandes reçues ce mois
  SELECT COUNT(*) INTO v_orders_month
  FROM orders
  WHERE shop_id   = p_shop_id
    AND created_at >= v_month_start;

  -- 6. Revenus des commandes terminées ce mois
  SELECT COALESCE(SUM(total), 0) INTO v_revenue_month
  FROM orders
  WHERE shop_id   = p_shop_id
    AND status     = 'done'
    AND created_at >= v_month_start;

  RETURN json_build_object(
    'views_this_month',   v_views_month,
    'visits_since_sub',   v_visits_since,
    'orders_this_month',  v_orders_month,
    'revenue_this_month', v_revenue_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_visibility_stats(UUID, TEXT) TO authenticated;
