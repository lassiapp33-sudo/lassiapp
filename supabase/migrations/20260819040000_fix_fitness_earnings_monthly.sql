-- ===========================================================================
-- Fix : get_daily_fitness_earnings utilisait processed_at >= today
-- Les abonnements achetés avant aujourd'hui (même mois) affichaient 0F.
-- Nouveau comportement : recette du mois courant (mois ISO UTC).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_daily_fitness_earnings(
  p_prestataire_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_month_start TIMESTAMPTZ;
  v_revenue     INTEGER;
  v_count       INTEGER;
BEGIN
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'UTC');

  SELECT
    COALESCE(SUM(pq.montant), 0)::INTEGER,
    COUNT(*)::INTEGER
  INTO v_revenue, v_count
  FROM public.payout_queue pq
  JOIN public.payment_intents pi ON pi.id = pq.payment_intent_id
  WHERE pq.prestataire_id = p_prestataire_id
    AND pq.statut         = 'paid'
    AND pq.processed_at  >= v_month_start
    AND (pi.metadata ->> 'offre_nom') IS NOT NULL;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'count',   v_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_fitness_earnings(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_daily_fitness_earnings(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
