-- Table de diagnostic push : stocke tickets Expo + receipts APNs/FCM
CREATE TABLE IF NOT EXISTS push_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  token       text NOT NULL,
  title       text,
  body        text,
  ticket_id   text,          -- ID retourné par Expo après l'envoi
  status      text,          -- 'sent' | 'ok' | 'error'
  receipt_status text,       -- 'ok' | 'error' (APNs/FCM receipt)
  receipt_message text,      -- message d'erreur APNs/FCM si status=error
  details     jsonb          -- payload complet pour debug
);

ALTER TABLE push_log ENABLE ROW LEVEL SECURITY;
-- Lecture réservée aux admins via service_role (Edge Functions)
-- Pas de policy publique — accès uniquement via dashboard Supabase

CREATE INDEX IF NOT EXISTS push_log_created_at_idx ON push_log (created_at DESC);
CREATE INDEX IF NOT EXISTS push_log_user_id_idx    ON push_log (user_id);
CREATE INDEX IF NOT EXISTS push_log_status_idx     ON push_log (status);
