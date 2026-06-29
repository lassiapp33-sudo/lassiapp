-- ─── RPC : statistiques de visibilité pour le marchand ──────────────────────
-- Appelé depuis l'app mobile pour afficher les vraies métriques sur la
-- vue "abonné" de VisibilityScreen.
--
-- Sécurité : SECURITY DEFINER pour contourner les RLS de recently_viewed
-- (qui n'expose les lignes qu'au client, pas au marchand).
-- La vérification d'appartenance est faite à l'intérieur de la fonction.

CREATE OR REPLACE FUNCTION get_shop_visibility_stats(p_shop_id UUID)
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
  FROM shops
  WHERE id = p_shop_id;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable';
  END IF;

  IF v_merchant_id <> auth.uid() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- 2. Date de début de l'abonnement actif (Offre du quartier)
  SELECT started_at INTO v_started_at
  FROM visibility_subscriptions
  WHERE shop_id = p_shop_id
    AND status  = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Si pas d'abonnement actif, on utilise le début du mois courant
  IF v_started_at IS NULL THEN
    v_started_at := v_month_start;
  END IF;

  -- 3. Vues ce mois (clients uniques dont la dernière visite est ce mois-ci)
  SELECT COUNT(*) INTO v_views_month
  FROM recently_viewed
  WHERE shop_id  = p_shop_id
    AND viewed_at >= v_month_start;

  -- 4. Visites depuis le début de l'abonnement (clics vers la boutique)
  SELECT COUNT(*) INTO v_visits_since
  FROM recently_viewed
  WHERE shop_id  = p_shop_id
    AND viewed_at >= v_started_at;

  -- 5. Commandes reçues ce mois (discussions lancées)
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

-- Accès : uniquement les utilisateurs authentifiés (la vérification interne
-- garantit que seul le marchand de la boutique peut lire ses propres stats).
GRANT EXECUTE ON FUNCTION get_shop_visibility_stats(UUID) TO authenticated;
