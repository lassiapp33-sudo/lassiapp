-- Remboursement prestataire en 2 temps (Wave) :
--   1. prestataire paie LASSI (Wave Checkout) le montant net qu'elle a perçu
--   2. LASSI reverse ce montant au client (Wave payout)
-- Cette table trace l'état de chaque remboursement entre les 2 étapes.

CREATE TABLE IF NOT EXISTS merchant_refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  merchant_id       UUID NOT NULL,
  client_id         UUID,
  client_phone      TEXT NOT NULL,
  amount            INTEGER NOT NULL,            -- montant net remboursé (= perçu prestataire)
  pay_method        TEXT NOT NULL DEFAULT 'wave',
  checkout_id       TEXT,                        -- session Wave (cos-...) payée par le prestataire
  checkout_ref      TEXT,                        -- client_reference = id de cette ligne
  client_payout_ref TEXT,                        -- ref du payout Wave vers le client
  status            TEXT NOT NULL DEFAULT 'awaiting_payment'
                    CHECK (status IN ('awaiting_payment','merchant_paid','client_refunded','failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_refunds_order ON merchant_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_merchant_refunds_status ON merchant_refunds(status);

ALTER TABLE merchant_refunds ENABLE ROW LEVEL SECURITY;
-- Accès uniquement via Edge Functions (service_role) — aucune policy publique.
