-- Toutes les stats (vues, clics, commandes, ventes) sont maintenant calculées
-- sur la période du forfait actif : started_at → NOW().
-- Si aucun abonnement actif, fallback sur le début du mois courant.

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
  v_views          BIGINT := 0;
  v_clics          BIGINT := 0;
  v_orders         BIGINT := 0;
  v_revenue        BIGINT := 0;
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = p_shop_id;
  IF v_merchant_id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable'; END IF;
  IF v_merchant_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  -- Début du forfait actif pour ce type d'offre
  SELECT started_at INTO v_started_at
  FROM visibility_subscriptions
  WHERE shop_id = p_shop_id AND status = 'active' AND offer_type = p_offer_type
  ORDER BY started_at DESC LIMIT 1;

  -- Fallback : pas de forfait actif → début du mois courant
  IF v_started_at IS NULL THEN
    v_started_at := date_trunc('month', NOW());
  END IF;

  -- Vues carrousel depuis le début du forfait
  SELECT COUNT(*) INTO v_views
  FROM carrousel_vues
  WHERE shop_id = p_shop_id AND viewed_at >= v_started_at;

  -- Clics carrousel depuis le début du forfait (même période)
  IF p_offer_type = 'quartier' THEN
    SELECT COUNT(*) INTO v_clics
    FROM carrousel_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  ELSIF p_offer_type = 'recherche' THEN
    SELECT COUNT(*) INTO v_clics
    FROM recherche_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  ELSIF p_offer_type = 'carte' THEN
    SELECT COUNT(*) INTO v_clics
    FROM carte_clics WHERE shop_id = p_shop_id AND clicked_at >= v_started_at;
  END IF;

  -- Commandes depuis le début du forfait
  SELECT COUNT(*) INTO v_orders
  FROM orders WHERE shop_id = p_shop_id AND created_at >= v_started_at;

  -- Ventes (commandes terminées) depuis le début du forfait
  SELECT COALESCE(SUM(total), 0) INTO v_revenue
  FROM orders WHERE shop_id = p_shop_id AND status = 'done' AND created_at >= v_started_at;

  RETURN json_build_object(
    'views_this_month',   v_views,
    'visits_since_sub',   v_clics,
    'orders_this_month',  v_orders,
    'revenue_this_month', v_revenue
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_visibility_stats(UUID, TEXT) TO authenticated;
