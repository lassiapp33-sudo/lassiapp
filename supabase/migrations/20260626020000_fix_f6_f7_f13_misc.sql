-- ===========================================================================
-- LASSI — Corrections FAIBLES F6, F7, F13
-- ===========================================================================

-- ─── F6 : orders_insert autorisait client_id IS NULL ─────────────────────────
-- La policy acceptait (client_id IS NULL OR client_id = auth.uid()), permettant
-- de créer des commandes orphelines sans propriétaire. Dans LASSI, toutes les
-- commandes doivent appartenir à un utilisateur authentifié.

DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND client_id = auth.uid()
    AND status = 'new'
  );


-- ─── F7 : valider la contrainte téléphone NOT VALID ──────────────────────────
-- Ajoutée en NOT VALID dans migration 20260611021000 pour ne pas bloquer
-- les données existantes. Les données ont été normalisées depuis (trigger
-- normalize_senegal_phone). On peut maintenant valider toutes les lignes.
-- VALIDATE CONSTRAINT acquiert un ShareUpdateExclusiveLock (non bloquant).

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_phone_format_check;


-- ─── F13 : statement_timeout sur les jobs pg_cron VIP/classements ────────────
-- Sans timeout, un calcul VIP qui part en dérive peut monopoliser la DB
-- indéfiniment. 5 minutes est largement suffisant pour le scoring LASSI.

DO $cron_vip$
BEGIN
  PERFORM cron.unschedule('lassi-vip-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron_vip$;

DO $cron_vip2$
BEGIN
  PERFORM cron.schedule(
    'lassi-vip-weekly',
    '0 0 * * 1',
    $sql$
      SET statement_timeout = '300000';
      SELECT public.update_vip_rankings('cron');
    $sql$
  );
  RAISE NOTICE 'pg_cron lassi-vip-weekly mis à jour avec statement_timeout=5min';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron non disponible (%) — mettre à jour manuellement', SQLERRM;
END $cron_vip2$;
