-- ===========================================================================
-- Fix : update_vip_rankings() ignorait fitness_abonnements_clients
-- Résultat : les prestataires sport/fitness avaient toujours 0 transaction
-- et ne pouvaient jamais entrer dans le VIP top 3.
-- Fix : UNION ALL orders + fitness_abonnements_clients (même logique que
-- calcul_classements_semaine, migration 20260810020000).
-- Bonus : notification in-app envoyée aux nouveaux top-3 chaque lundi.
-- ===========================================================================

-- Supprimer toutes les surcharges existantes pour éviter l'ambiguïté PGRST203
DROP FUNCTION IF EXISTS public.update_vip_rankings(TEXT);
DROP FUNCTION IF EXISTS public.update_vip_rankings();

CREATE OR REPLACE FUNCTION public.update_vip_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ① Reset VIP pour les shops classiques (pas les 5 Étoiles)
  UPDATE public.shops
  SET is_vip = false, vip_rank = null
  WHERE is_etoiles = false;

  -- ② Calcul top 3 par catégorie sur les 7 derniers jours
  --    Inclut : commandes Wave/OM finalisées + abonnements fitness payés
  WITH
  orders_raw AS (
    SELECT s.id AS shop_id, s.category
    FROM public.shops s
    JOIN public.orders o ON o.shop_id = s.id
    WHERE o.status      = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at  >= NOW() - INTERVAL '7 days'
      AND s.is_etoiles  = false
  ),

  fitness_raw AS (
    SELECT s.id AS shop_id, s.category
    FROM public.fitness_abonnements_clients fac
    JOIN public.shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat        >= NOW() - INTERVAL '7 days'
      AND fac.payment_intent_id IS NOT NULL
      AND s.is_etoiles           = false
  ),

  all_txns AS (
    SELECT shop_id, category FROM orders_raw
    UNION ALL
    SELECT shop_id, category FROM fitness_raw
  ),

  weekly_counts AS (
    SELECT shop_id, category, COUNT(*) AS txn_count
    FROM all_txns
    GROUP BY shop_id, category
  ),

  ranked AS (
    SELECT
      shop_id,
      txn_count,
      ROW_NUMBER() OVER (
        PARTITION BY category
        ORDER BY txn_count DESC
      ) AS rnk
    FROM weekly_counts
  )

  UPDATE public.shops
  SET is_vip = true, vip_rank = ranked.rnk
  FROM ranked
  WHERE public.shops.id = ranked.shop_id
    AND ranked.rnk <= 3;

  -- ③ Notifier chaque nouveau top-3 (in-app, best-effort)
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    s.merchant_id,
    'vip',
    CASE s.vip_rank
      WHEN 1 THEN 'Vous êtes n°1 de votre catégorie'
      WHEN 2 THEN 'Vous êtes n°2 de votre catégorie'
      ELSE        'Vous êtes dans le top 3 de votre catégorie'
    END,
    'Félicitations pour cette semaine. Continuez ainsi.',
    jsonb_build_object('type', 'vip_top3', 'vip_rank', s.vip_rank)
  FROM public.shops s
  WHERE s.is_vip     = true
    AND s.is_etoiles = false
    AND s.merchant_id IS NOT NULL;

END;
$$;

-- ④ Mettre à jour le pg_cron pour utiliser la signature sans paramètre
DO $cron$
BEGIN
  PERFORM cron.unschedule('lassi-vip-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron$;

DO $cron2$
BEGIN
  PERFORM cron.schedule(
    'lassi-vip-weekly',
    '0 0 * * 1',
    $sql$SELECT public.update_vip_rankings()$sql$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $cron2$;

-- ⑤ Recalcul immédiat pour corriger l'état actuel
SELECT public.update_vip_rankings();
