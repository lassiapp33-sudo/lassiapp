-- ============================================================
-- TABLE : terrains
-- ============================================================
CREATE TABLE IF NOT EXISTS terrains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  prix_horaire INTEGER NOT NULL, -- en FCFA, marge 0.5% déjà incluse
  sport_type TEXT NOT NULL DEFAULT 'football', -- football, basketball, tennis, volleyball, autre
  capacite INTEGER DEFAULT 10,
  adresse TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE : terrain_horaires
-- Horaires d'ouverture/fermeture par jour de la semaine
-- ============================================================
CREATE TABLE IF NOT EXISTS terrain_horaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id UUID NOT NULL REFERENCES terrains(id) ON DELETE CASCADE,
  jour_semaine INTEGER NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6),
  -- 0=Dimanche, 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi, 6=Samedi
  heure_ouverture TIME NOT NULL, -- ex: '08:00'
  heure_fermeture TIME NOT NULL, -- ex: '22:00'
  ferme BOOLEAN DEFAULT false, -- si true, fermé ce jour-là
  UNIQUE(terrain_id, jour_semaine)
);

-- ============================================================
-- TABLE : reservations_terrain
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations_terrain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  terrain_id UUID NOT NULL REFERENCES terrains(id),
  prestataire_id UUID NOT NULL REFERENCES profiles(id),

  -- Créneau
  date_reservation DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  duree_heures NUMERIC(3,1) NOT NULL, -- ex: 1.5 pour 1h30

  -- Montants
  prix_total INTEGER NOT NULL, -- en FCFA (marge 0.5% incluse)
  commission_lassi INTEGER NOT NULL, -- 0.5% du prix_total
  montant_prestataire INTEGER NOT NULL, -- prix_total - commission_lassi

  -- Paiement
  moyen_paiement TEXT CHECK (moyen_paiement IN ('wave', 'orange_money')),
  paiement_ref TEXT,

  -- Reçu
  receipt_code TEXT UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  receipt_valid_until TIMESTAMPTZ,
  receipt_status TEXT DEFAULT 'pending'
    CHECK (receipt_status IN ('pending', 'valide', 'utilise', 'expire')),

  -- Statut
  statut TEXT DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'paye', 'utilise', 'expire', 'annule')),

  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Contrainte : pas de chevauchement pour le même terrain à la même date
  CONSTRAINT no_overlap EXCLUDE USING gist (
    terrain_id WITH =,
    date_reservation WITH =,
    tsrange(
      (date_reservation + heure_debut)::TIMESTAMPTZ,
      (date_reservation + heure_fin)::TIMESTAMPTZ
    ) WITH &&
  ) WHERE (statut NOT IN ('annule', 'expire'))
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_reservations_terrain_date ON reservations_terrain(terrain_id, date_reservation);
CREATE INDEX IF NOT EXISTS idx_reservations_client ON reservations_terrain(client_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE terrains ENABLE ROW LEVEL SECURITY;
ALTER TABLE terrain_horaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations_terrain ENABLE ROW LEVEL SECURITY;

-- TERRAINS
DROP POLICY IF EXISTS "terrains_public_read" ON terrains;
CREATE POLICY "terrains_public_read" ON terrains
  FOR SELECT USING (actif = true);

DROP POLICY IF EXISTS "terrains_prestataire_manage" ON terrains;
CREATE POLICY "terrains_prestataire_manage" ON terrains
  FOR ALL USING (auth.uid() = prestataire_id);

-- HORAIRES
DROP POLICY IF EXISTS "horaires_public_read" ON terrain_horaires;
CREATE POLICY "horaires_public_read" ON terrain_horaires
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "horaires_prestataire_manage" ON terrain_horaires;
CREATE POLICY "horaires_prestataire_manage" ON terrain_horaires
  FOR ALL USING (
    auth.uid() = (SELECT prestataire_id FROM terrains WHERE id = terrain_id)
  );

-- RESERVATIONS
DROP POLICY IF EXISTS "reservations_client_read" ON reservations_terrain;
CREATE POLICY "reservations_client_read" ON reservations_terrain
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = prestataire_id);

DROP POLICY IF EXISTS "reservations_client_insert" ON reservations_terrain;
CREATE POLICY "reservations_client_insert" ON reservations_terrain
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "reservations_prestataire_update" ON reservations_terrain;
CREATE POLICY "reservations_prestataire_update" ON reservations_terrain
  FOR UPDATE USING (auth.uid() = prestataire_id OR auth.uid() = client_id);

-- ============================================================
-- FONCTION : créneaux réservés pour un terrain + date
-- ============================================================
DROP FUNCTION IF EXISTS get_crenaux_pris(UUID, DATE);
CREATE OR REPLACE FUNCTION get_crenaux_pris(
  p_terrain_id UUID,
  p_date DATE
)
RETURNS TABLE(heure_debut TIME, heure_fin TIME)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT heure_debut, heure_fin
  FROM reservations_terrain
  WHERE terrain_id = p_terrain_id
    AND date_reservation = p_date
    AND statut NOT IN ('annule', 'expire')
  ORDER BY heure_debut;
$$;

-- ============================================================
-- FONCTION : vérifier + marquer un QR code utilisé (atomique)
-- ============================================================
DROP FUNCTION IF EXISTS verify_terrain_receipt(TEXT, UUID);
CREATE OR REPLACE FUNCTION verify_terrain_receipt(
  p_receipt_code TEXT,
  p_prestataire_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reservation reservations_terrain%ROWTYPE;
BEGIN
  SELECT * INTO v_reservation
  FROM reservations_terrain
  WHERE receipt_code = upper(p_receipt_code)
    AND prestataire_id = p_prestataire_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code introuvable');
  END IF;

  IF v_reservation.statut != 'paye' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservation non payée');
  END IF;

  IF v_reservation.receipt_status = 'utilise' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà utilisé');
  END IF;

  IF v_reservation.receipt_valid_until IS NOT NULL AND v_reservation.receipt_valid_until < now() THEN
    UPDATE reservations_terrain SET receipt_status = 'expire', statut = 'expire'
    WHERE id = v_reservation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Reçu expiré');
  END IF;

  UPDATE reservations_terrain
  SET receipt_status = 'utilise', statut = 'utilise', validated_at = now(), updated_at = now()
  WHERE id = v_reservation.id;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_reservation.client_id,
    'terrain_id', v_reservation.terrain_id,
    'heure_debut', v_reservation.heure_debut,
    'heure_fin', v_reservation.heure_fin,
    'date_reservation', v_reservation.date_reservation
  );
END;
$$;

-- Activer Realtime sur reservations_terrain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reservations_terrain'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservations_terrain;
  END IF;
END $$;
