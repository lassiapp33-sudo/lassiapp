-- ============================================================
-- TABLE : payment_intents
-- Source de vérité unique pour chaque tentative de paiement
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexte commande
  order_id UUID REFERENCES orders(id),          -- si commande classique
  reservation_id UUID REFERENCES reservations_terrain(id), -- si terrain

  -- Parties
  client_id UUID NOT NULL REFERENCES profiles(id),
  prestataire_id UUID NOT NULL REFERENCES profiles(id),

  -- Montants (TOUJOURS en FCFA entier, JAMAIS de virgule)
  prix_base INTEGER NOT NULL,         -- prix fixé par le prestataire (ce qu'il doit recevoir avant frais opérateur)
  commission_lassi INTEGER NOT NULL,  -- 1% du prix_base, arrondi au FCFA supérieur — supporté par le CLIENT
  montant_total INTEGER NOT NULL,     -- prix_base + commission_lassi = ce que le client paie à LASSI
  -- Invariant serveur : commission_lassi = CEIL(prix_base * 0.01)
  -- Invariant serveur : montant_total = prix_base + commission_lassi
  -- Frais opérateur (séparés, hors commission LASSI) :
  --   Wave  : ~1% à l'entrée (sur montant_total) + ~1% à la sortie (sur prix_base) → prestataire reçoit ~prix_base × 0.99
  --   OM    : 1% prélevé par OM sur le client + 0.5% prélevé par OM sur le prestataire → prestataire reçoit ~prix_base × 0.995

  -- Paiement
  moyen_paiement TEXT NOT NULL CHECK (moyen_paiement IN ('wave', 'orange_money')),

  -- Idempotency (évite double débit si réseau coupe)
  idempotency_key TEXT UNIQUE NOT NULL,

  -- Référence externe Wave ou OM (remplie par l'API)
  external_ref TEXT,          -- ID transaction Wave/OM
  external_status TEXT,       -- statut retourné par Wave/OM

  -- Split (rempli après confirmation)
  split_prestataire_ref TEXT, -- preuve que le presta a reçu sa part
  split_lassi_ref TEXT,       -- preuve que LASSİ a reçu sa commission

  -- Statut interne
  statut TEXT NOT NULL DEFAULT 'pending'
    CHECK (statut IN (
      'pending',      -- créé, paiement pas encore initié
      'initiated',    -- requête envoyée à Wave/OM
      'confirmed',    -- Wave/OM confirme réception
      'split_done',   -- split effectué, tout le monde payé
      'failed',       -- échec paiement
      'refunded',     -- remboursé (cas exceptionnel)
      'simulated'     -- mode simulation (sans API réelle)
    )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  confirmed_at TIMESTAMPTZ,
  split_done_at TIMESTAMPTZ,

  -- Contrainte de cohérence
  CONSTRAINT check_montants CHECK (
    commission_lassi = CEIL(prix_base * 0.01) AND
    montant_total = prix_base + commission_lassi
  )
);

-- ============================================================
-- TABLE : payment_logs
-- Journal immuable de chaque événement (audit bancaire)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id),
  event_type TEXT NOT NULL,  -- 'created','initiated','confirmed','split','failed','webhook'
  event_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- IMMUABLE : pas de UPDATE/DELETE sur payment_logs
DO $$ BEGIN
  DROP RULE IF EXISTS payment_logs_no_update ON payment_logs;
  CREATE RULE payment_logs_no_update AS ON UPDATE TO payment_logs DO INSTEAD NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP RULE IF EXISTS payment_logs_no_delete ON payment_logs;
  CREATE RULE payment_logs_no_delete AS ON DELETE TO payment_logs DO INSTEAD NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_payment_intent_client ON payment_intents(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_intent_order ON payment_intents(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intent_idempotency ON payment_intents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_logs_intent ON payment_logs(payment_intent_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Client voit ses propres payment_intents
DROP POLICY IF EXISTS "pi_client_read" ON payment_intents;
CREATE POLICY "pi_client_read" ON payment_intents
  FOR SELECT USING (auth.uid() = client_id);

-- Prestataire voit les paiements qui le concernent
DROP POLICY IF EXISTS "pi_prestataire_read" ON payment_intents;
CREATE POLICY "pi_prestataire_read" ON payment_intents
  FOR SELECT USING (auth.uid() = prestataire_id);

-- Création uniquement par le client authentifié
DROP POLICY IF EXISTS "pi_client_insert" ON payment_intents;
CREATE POLICY "pi_client_insert" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Edge Functions peuvent tout faire (service role)
-- (pas de RLS pour service_role, c'est le comportement par défaut Supabase)

-- Logs : lecture seule pour les parties concernées
DROP POLICY IF EXISTS "logs_read" ON payment_logs;
CREATE POLICY "logs_read" ON payment_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT client_id FROM payment_intents WHERE id = payment_intent_id
      UNION
      SELECT prestataire_id FROM payment_intents WHERE id = payment_intent_id
    )
  );

-- ============================================================
-- FONCTION : créer un payment_intent de façon atomique
-- Vérifie la cohérence des montants côté serveur (jamais faire confiance au client)
-- ============================================================
CREATE OR REPLACE FUNCTION create_payment_intent(
  p_order_id UUID,
  p_client_id UUID,
  p_prestataire_id UUID,
  p_prix_base INTEGER,
  p_moyen_paiement TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_commission INTEGER;
  v_total INTEGER;
  v_pi_id UUID;
BEGIN
  -- Idempotency : si même clé existe, retourner l'existant
  SELECT id INTO v_pi_id FROM payment_intents WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_pi_id; END IF;

  -- Recalcul SERVEUR des montants (ne jamais faire confiance aux montants du client)
  v_commission := CEIL(p_prix_base * 0.01);
  v_total := p_prix_base + v_commission;

  -- Validation
  IF p_prix_base < 100 OR p_prix_base > 5000000 THEN
    RAISE EXCEPTION 'montant_invalide: % FCFA', p_prix_base;
  END IF;

  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RAISE EXCEPTION 'moyen_paiement_invalide: %', p_moyen_paiement;
  END IF;

  INSERT INTO payment_intents (
    order_id, client_id, prestataire_id,
    prix_base, commission_lassi, montant_total,
    moyen_paiement, idempotency_key, statut
  ) VALUES (
    p_order_id, p_client_id, p_prestataire_id,
    p_prix_base, v_commission, v_total,
    p_moyen_paiement, p_idempotency_key, 'pending'
  ) RETURNING id INTO v_pi_id;

  -- Log création
  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
  VALUES (v_pi_id, 'created', jsonb_build_object(
    'prix_base', p_prix_base,
    'commission', v_commission,
    'total', v_total,
    'moyen', p_moyen_paiement
  ));

  RETURN v_pi_id;
END;
$$;
