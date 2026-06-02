-- ─── Vus récemment ───────────────────────────────────────────────────────────
-- Enregistre les commerces consultés par chaque client.
-- UPSERT sur (client_id, shop_id) : met à jour viewed_at à chaque nouvelle visite.

CREATE TABLE IF NOT EXISTS recently_viewed (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id)       ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, shop_id)
);

CREATE INDEX IF NOT EXISTS rv_client_idx ON recently_viewed (client_id, viewed_at DESC);

ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_sees_own_rv"    ON recently_viewed;
DROP POLICY IF EXISTS "client_inserts_own_rv" ON recently_viewed;
DROP POLICY IF EXISTS "client_updates_own_rv" ON recently_viewed;
DROP POLICY IF EXISTS "client_deletes_own_rv" ON recently_viewed;

CREATE POLICY "client_sees_own_rv" ON recently_viewed
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "client_inserts_own_rv" ON recently_viewed
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "client_updates_own_rv" ON recently_viewed
  FOR UPDATE
  USING     (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "client_deletes_own_rv" ON recently_viewed
  FOR DELETE USING (auth.uid() = client_id);
