-- ============================================================
-- LASSI · Planification automatique des classements · Migration 2026-06-11 (Phase 5)
-- ============================================================
-- pg_cron : calcul hebdo (sous-catégorie) + mensuel (mondial/quartiers/clients).
-- Le calcul reste 100% côté serveur — l'app ne fait que lire `classements`.
-- cron.schedule(job_name, ...) met à jour le job existant si le nom existe déjà
-- (pg_cron >= 1.4), cette migration est donc rejouable sans erreur.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- HEBDO : chaque dimanche 23h59 → classement sous-catégorie
-- ============================================================
SELECT cron.schedule(
  'classement-hebdo',
  '59 23 * * 0',  -- dimanche 23h59
  $$
    SELECT calculer_classement_sous_categorie(
      to_char(now(), 'IYYY') || '-S' || to_char(now(), 'IW')
    );
  $$
);

-- ============================================================
-- MENSUEL : le 1er du mois 00h00 → mondial + quartiers + clients
-- ============================================================
SELECT cron.schedule(
  'classement-mensuel',
  '0 0 1 * *',  -- 1er du mois à minuit
  $$
    SELECT calculer_classement_mondial(to_char(now() - interval '1 day', 'YYYY-MM'));
    SELECT calculer_classement_quartiers(to_char(now() - interval '1 day', 'YYYY-MM'));
    SELECT calculer_classement_clients(to_char(now() - interval '1 day', 'YYYY-MM'));
  $$
);

-- Attribution des récompenses mondiales + notif ville (Edge Function Phase 4) :
-- déclenchée par GitHub Actions (.github/workflows/classements-mensuel.yml),
-- 10 min après ce job, avec le secret CRON_SECRET déjà configuré pour
-- update-vip-rankings — aucune configuration manuelle supplémentaire requise.
