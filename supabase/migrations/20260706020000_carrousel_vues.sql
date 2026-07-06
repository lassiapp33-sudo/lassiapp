-- Table carrousel_vues : chaque passage d'un produit devant un client dans le carrousel.
-- Différent de carrousel_clics (qui comptent les appuis) : ici on comptabilise les impressions.
-- Pas de contrainte UNIQUE : repasser devant le même client = nouvelle vue.

CREATE TABLE IF NOT EXISTS carrousel_vues (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id)       ON DELETE CASCADE,
  product_id UUID                                     REFERENCES products(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carrousel_vues_shop_viewed_idx
  ON carrousel_vues(shop_id, viewed_at);

ALTER TABLE carrousel_vues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_insert_own_vue" ON carrousel_vues
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Mise à jour RPC : views_this_month vient maintenant de carrousel_vues
-- (impressions carrousel) au lieu de recently_viewed (visites boutique).
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
  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = p_shop_id;
  IF v_merchant_id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable'; END IF;
  IF v_merchant_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT started_at INTO v_started_at
  FROM visibility_subscriptions
  WHERE shop_id = p_shop_id AND status = 'active' AND offer_type = p_offer_type
  ORDER BY started_at DESC LIMIT 1;

  IF v_started_at IS NULL THEN v_started_at := v_month_start; END IF;

  -- Vues : passages de produit devant les clients dans le carrousel ce mois
  SELECT COUNT(*) INTO v_views_month
  FROM carrousel_vues
  WHERE shop_id = p_shop_id AND viewed_at >= v_month_start;

  -- Clics : appuis sur le produit dans le carrousel depuis le début de l'abonnement
  IF p_offer_type = 'quartier' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM carrousel_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  ELSIF p_offer_type = 'recherche' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM recherche_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  ELSIF p_offer_type = 'carte' THEN
    SELECT COUNT(*) INTO v_visits_since
    FROM carte_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  END IF;

  SELECT COUNT(*) INTO v_orders_month
  FROM orders WHERE shop_id = p_shop_id AND created_at >= v_month_start;

  SELECT COALESCE(SUM(total), 0) INTO v_revenue_month
  FROM orders WHERE shop_id = p_shop_id AND status = 'done' AND created_at >= v_month_start;

  RETURN json_build_object(
    'views_this_month',   v_views_month,
    'visits_since_sub',   v_visits_since,
    'orders_this_month',  v_orders_month,
    'revenue_this_month', v_revenue_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_visibility_stats(UUID, TEXT) TO authenticated;
