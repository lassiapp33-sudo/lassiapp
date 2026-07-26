-- Correction : "Clics vers ta boutique" utilisait v_started_at (depuis le début de l'abonnement)
-- alors que "Vues ce mois" utilise v_month_start (ce mois-ci).
-- Cette incohérence donnait clics >> vues, ce qui est illogique (on voit avant de cliquer).
-- Fix : les DEUX métriques utilisent maintenant v_month_start = début du mois en cours.
-- Le champ visits_since_sub est renommé logiquement "clics_this_month" dans le JSON
-- mais on garde la clé pour ne pas casser le type TS (visitsSinceSub côté app).

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
  v_month_start    TIMESTAMPTZ := date_trunc('month', NOW());
  v_views_month    BIGINT := 0;
  v_clics_month    BIGINT := 0;
  v_orders_month   BIGINT := 0;
  v_revenue_month  BIGINT := 0;
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = p_shop_id;
  IF v_merchant_id IS NULL THEN RAISE EXCEPTION 'Boutique introuvable'; END IF;
  IF v_merchant_id <> auth.uid() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  -- Vues : impressions carrousel ce mois (un seul type de source, une seule période)
  SELECT COUNT(*) INTO v_views_month
  FROM carrousel_vues
  WHERE shop_id = p_shop_id AND viewed_at >= v_month_start;

  -- Clics : appuis sur un produit du carrousel ce mois (même période que les vues)
  IF p_offer_type = 'quartier' THEN
    SELECT COUNT(*) INTO v_clics_month
    FROM carrousel_clics WHERE shop_id = p_shop_id AND clicked_at >= v_month_start;
  ELSIF p_offer_type = 'recherche' THEN
    SELECT COUNT(*) INTO v_clics_month
    FROM recherche_clics WHERE shop_id = p_shop_id AND clicked_at >= v_month_start;
  ELSIF p_offer_type = 'carte' THEN
    SELECT COUNT(*) INTO v_clics_month
    FROM carte_clics WHERE shop_id = p_shop_id AND clicked_at >= v_month_start;
  END IF;

  SELECT COUNT(*) INTO v_orders_month
  FROM orders WHERE shop_id = p_shop_id AND created_at >= v_month_start;

  SELECT COALESCE(SUM(total), 0) INTO v_revenue_month
  FROM orders WHERE shop_id = p_shop_id AND status = 'done' AND created_at >= v_month_start;

  RETURN json_build_object(
    'views_this_month',   v_views_month,
    'visits_since_sub',   v_clics_month,   -- clé conservée pour compatibilité TS
    'orders_this_month',  v_orders_month,
    'revenue_this_month', v_revenue_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_visibility_stats(UUID, TEXT) TO authenticated;
