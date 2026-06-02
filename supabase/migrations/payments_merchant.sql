-- ─── Table payments ──────────────────────────────────────────────────────────
-- Créée si elle n'existe pas encore (les Edge Functions peuvent déjà l'avoir créée).

CREATE TABLE IF NOT EXISTS payments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id       UUID REFERENCES orders(id)      ON DELETE SET NULL,
  client_id      UUID REFERENCES auth.users(id)  ON DELETE SET NULL,
  prestataire_id UUID REFERENCES auth.users(id)  ON DELETE SET NULL,
  amount         DECIMAL(10,2)  DEFAULT 0,
  method         TEXT           CHECK (method IN ('wave','om')),
  status         TEXT           DEFAULT 'pending'
                                CHECK (status IN ('pending','success','failed','refunded')),
  reference      TEXT,
  client_name    TEXT,
  items          JSONB          DEFAULT '[]',
  created_at     TIMESTAMPTZ    DEFAULT NOW()
);

-- Ajouter prestataire_id si la table existait déjà sans cette colonne
ALTER TABLE payments ADD COLUMN IF NOT EXISTS prestataire_id UUID REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_name    TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS items          JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS payments_prestataire_idx ON payments (prestataire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_client_idx      ON payments (client_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestataire_sees_own_payments" ON payments;
CREATE POLICY "prestataire_sees_own_payments" ON payments
  FOR SELECT USING (auth.uid() = prestataire_id);

DROP POLICY IF EXISTS "client_sees_own_payment_receipts" ON payments;
CREATE POLICY "client_sees_own_payment_receipts" ON payments
  FOR SELECT USING (auth.uid() = client_id);
