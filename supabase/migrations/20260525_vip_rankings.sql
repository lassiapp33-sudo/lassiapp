-- Fonction de calcul VIP hebdomadaire
-- Top 3 par catégorie basé sur les commandes finalisées payées via LASSI (wave/om)

CREATE OR REPLACE FUNCTION update_vip_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Tout le monde perd le statut VIP
  UPDATE shops SET is_vip = false;

  -- 2. Top 3 par catégorie sur les 7 derniers jours
  WITH weekly_counts AS (
    SELECT
      s.id        AS shop_id,
      s.category,
      COUNT(o.id) AS order_count
    FROM shops s
    JOIN orders o ON o.shop_id = s.id
      AND o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY s.id, s.category
  ),
  ranked AS (
    SELECT
      shop_id,
      ROW_NUMBER() OVER (PARTITION BY category ORDER BY order_count DESC) AS rnk
    FROM weekly_counts
  )
  UPDATE shops
  SET is_vip = true
  WHERE id IN (SELECT shop_id FROM ranked WHERE rnk <= 3);
END;
$$;

-- Planifier chaque lundi à 00h00 UTC (si pg_cron est activé)
-- SELECT cron.schedule('lassi-vip-weekly', '0 0 * * 1', 'SELECT update_vip_rankings();');
