-- ============================================================
-- LASSI · Fonction payment_health_check()
-- Diagnostic paiements complet en 1 appel (SQL Editor ou cron alert)
-- Retourne une ligne par catégorie d'anomalie avec un count et des détails.
-- ============================================================

CREATE OR REPLACE FUNCTION payment_health_check()
RETURNS TABLE (
  check_name   TEXT,
  severity     TEXT,   -- 'ok', 'warn', 'critical'
  count        INTEGER,
  detail       TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN

  -- 1. Paiements disputés (montant reçu ≠ montant attendu)
  RETURN QUERY
  SELECT
    'disputed_payments'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'critical' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payment_intents en statut disputed — vérifier les montants envoyés vs stockés')::TEXT
  FROM payment_intents
  WHERE statut = 'disputed'
    AND created_at > now() - interval '30 days';

  -- 2. Payouts en échec terminal
  RETURN QUERY
  SELECT
    'terminal_failed_payouts'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'critical' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payout_queue en statut failed — reversements bloqués, intervention manuelle requise')::TEXT
  FROM payout_queue
  WHERE statut = 'failed';

  -- 3. split_done sans payout_queue (orphelins récents — ne seront jamais reversés)
  -- Fenêtre 30j pour exclure les anciens tests pre-payout_queue (simulation mode avant oct 2026)
  RETURN QUERY
  SELECT
    'split_done_without_payout'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'critical' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payment_intent (30j) confirmé mais aucune entrée payout_queue — perte de reversement')::TEXT
  FROM payment_intents pi
  WHERE pi.statut = 'split_done'
    AND pi.created_at > now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM payout_queue pq WHERE pq.payment_intent_id = pi.id);

  -- 4. Payouts en cours depuis plus de 10 min (bloqués)
  RETURN QUERY
  SELECT
    'stuck_processing_payouts'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payout_queue en statut processing depuis > 10 min — edge function crashée ?')::TEXT
  FROM payout_queue
  WHERE statut = 'processing'
    AND updated_at < now() - interval '10 minutes';

  -- 5. Équation comptable brisée (total ≠ base + commission + livraison)
  RETURN QUERY
  SELECT
    'amount_equation_broken'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'critical' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payment_intents dont montant_total ≠ prix_base + commission_lassi + livraison_fee')::TEXT
  FROM payment_intents
  WHERE montant_total <> prix_base + commission_lassi + COALESCE(livraison_fee, 0)
    AND statut NOT IN ('failed', 'disputed');

  -- 6. Taux de commission anormal (ni 1% ni 2%) — prix_base >= 100 pour éviter faux positifs CEIL
  RETURN QUERY
  SELECT
    'abnormal_commission_rate'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'critical' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payment_intents (7j, base >= 100F) avec taux commission ≠ 1% ou 2% — vérifier payment_utils.ts')::TEXT
  FROM payment_intents
  WHERE created_at > now() - interval '7 days'
    AND prix_base >= 100
    AND ABS(commission_lassi::NUMERIC / prix_base - 0.01) > 0.005
    AND ABS(commission_lassi::NUMERIC / prix_base - 0.02) > 0.005
    AND statut NOT IN ('failed');

  -- 7. PI Wave initiated depuis plus de 30 min (webhook manqué, réconciliation requise)
  RETURN QUERY
  SELECT
    'stale_initiated_wave'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('payment_intents Wave initiated depuis > 30 min — webhook manqué ou session expirée')::TEXT
  FROM payment_intents
  WHERE statut = 'initiated'
    AND moyen_paiement = 'wave'
    AND created_at < now() - interval '30 minutes';

  -- 8. Prestataires sans numéro (payout impossible)
  RETURN QUERY
  SELECT
    'merchants_without_phone'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'ok' END::TEXT,
    COUNT(*)::INTEGER,
    ('boutiques actives dont le prestataire n''a pas de numéro valide — aucun reversement possible')::TEXT
  FROM shops s
  JOIN profiles p ON p.id = s.merchant_id
  WHERE (p.phone IS NULL OR p.phone = '' OR NOT (p.phone ~ '^7[05678][0-9]{7}$'))
    AND EXISTS (
      SELECT 1 FROM payment_intents pi
      WHERE pi.prestataire_id = s.merchant_id
        AND pi.created_at > now() - interval '90 days'
    );

END;
$$;
