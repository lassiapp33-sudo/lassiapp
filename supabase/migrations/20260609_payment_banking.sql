-- ============================================================
-- LASSI · Architecture bancaire · Migration 2026-06-09
-- ============================================================
-- Tables : payment_logs (immuable) + payment_idempotency
-- Déployer via : supabase db push
-- ============================================================

-- ─── Journal de paiement immuable ─────────────────────────────────────────────
-- INSERT only : toute la vie d'une transaction est tracée ici
-- Jamais de UPDATE ni DELETE pour préserver l'audit trail

CREATE TABLE IF NOT EXISTS payment_logs (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        timestamptz DEFAULT now()             NOT NULL,
  event_type        text                                  NOT NULL,
  reference         text,
  ticket_id         text,
  user_id           uuid,
  amount            integer,
  commission        integer,
  method            text,
  provider          text,     -- 'wave' | 'orange_money' | 'simulation'
  status            text      NOT NULL,
  provider_response jsonb,
  metadata          jsonb
);

-- Index pour les requêtes courantes (dashboard admin, réconciliation)
CREATE INDEX IF NOT EXISTS idx_payment_logs_reference   ON payment_logs (reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_ticket_id   ON payment_logs (ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id     ON payment_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at  ON payment_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status      ON payment_logs (status);

-- RLS : seul le service_role peut lire/écrire. Pas d'accès client direct.
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert" ON payment_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_role_select" ON payment_logs
  FOR SELECT TO service_role USING (true);

-- Interdire explicitement UPDATE et DELETE (journal immuable)
-- Note : avec service_role RLS bypass, ces policies couvrent les autres rôles
REVOKE UPDATE, DELETE ON payment_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON payment_logs FROM authenticated;
REVOKE UPDATE, DELETE ON payment_logs FROM anon;

-- ─── Idempotency keys ─────────────────────────────────────────────────────────
-- Évite les doubles paiements sur retry réseau ou double-clic

CREATE TABLE IF NOT EXISTS payment_idempotency (
  idempotency_key text        PRIMARY KEY,
  created_at      timestamptz DEFAULT now() NOT NULL,
  expires_at      timestamptz               NOT NULL,
  response        jsonb                     NOT NULL,
  status          text                      NOT NULL  -- 'completed' | 'processing'
);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_expires
  ON payment_idempotency (expires_at);

ALTER TABLE payment_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON payment_idempotency
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cleanup automatique des clés expirées (pg_cron si disponible)
-- SELECT cron.schedule('cleanup-idempotency', '0 3 * * *',
--   'DELETE FROM payment_idempotency WHERE expires_at < now()');

-- ─── Vue réconciliation pour le dashboard admin ───────────────────────────────

CREATE OR REPLACE VIEW v_payment_reconciliation AS
SELECT
  reference,
  ticket_id,
  MAX(amount)     AS amount,
  MAX(commission) AS commission,
  method,
  provider,
  MIN(created_at) AS initiated_at,
  MAX(created_at) AS last_event_at,
  -- Statut final : prend le dernier événement
  (
    SELECT status FROM payment_logs pl2
    WHERE pl2.reference = pl.reference
    ORDER BY created_at DESC LIMIT 1
  ) AS final_status,
  COUNT(*) AS event_count
FROM payment_logs pl
WHERE reference IS NOT NULL
GROUP BY reference, ticket_id, method, provider;

GRANT SELECT ON v_payment_reconciliation TO service_role;

-- ─── Commentaires documentation ──────────────────────────────────────────────
COMMENT ON TABLE payment_logs IS
  'Journal immuable de tous les événements de paiement LASSI. INSERT only.';

COMMENT ON TABLE payment_idempotency IS
  'Cache idempotency 24h — évite les doubles appels API Wave/OM sur retry réseau.';
