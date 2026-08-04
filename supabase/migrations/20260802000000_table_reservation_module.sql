-- ===========================================================================
-- LASSI — Module Réservation de Table (exclusif 5 Étoiles)
-- ===========================================================================
-- Montant client : 3 000 FCFA acompte restaurant + 200 FCFA frais LASSI = 3 200 FCFA
-- Statuts : en_attente → acceptee | alternative_proposee | refusee → arrivee → terminee
-- QR code généré côté Edge Function lors de l'acceptation
-- ===========================================================================

-- ─── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.table_reservation_statut AS ENUM (
    'en_attente',
    'acceptee',
    'alternative_proposee',
    'refusee',
    'arrivee',
    'terminee',
    'annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.table_reservation_motif AS ENUM (
    'anniversaire',
    'mariage',
    'fiancailles',
    'fete_surprise',
    'affaires',
    'romantique',
    'autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Espaces / zones du restaurant ─────────────────────────────────────────
-- Chaque établissement 5 Étoiles configure ses étages/zones avec photo.

CREATE TABLE IF NOT EXISTS public.restaurant_spaces (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_profil_id   UUID        NOT NULL REFERENCES public.vip_profils(id) ON DELETE CASCADE,
  nom             TEXT        NOT NULL,                -- "Étage 1", "Terrasse VIP"
  description     TEXT,
  photo_url       TEXT,
  capacite        SMALLINT,                            -- capacité max (convives)
  position        SMALLINT    NOT NULL DEFAULT 0,      -- ordre d'affichage
  actif           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Créneaux horaires du restaurant ───────────────────────────────────────
-- Le restaurateur définit ses plages (ex. "Déjeuner 12h-14h" jours 1-5).

CREATE TABLE IF NOT EXISTS public.restaurant_time_slots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_profil_id   UUID        NOT NULL REFERENCES public.vip_profils(id) ON DELETE CASCADE,
  label           TEXT        NOT NULL,                -- "Déjeuner", "Dîner"
  heure_debut     TIME        NOT NULL,
  heure_fin       TIME        NOT NULL,
  jours_semaine   SMALLINT[]  NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Dim … 6=Sam
  actif           BOOLEAN     NOT NULL DEFAULT true,
  position        SMALLINT    NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_heures CHECK (heure_fin > heure_debut)
);

-- ─── 4. Réservations de table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.table_reservations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  client_id           UUID        NOT NULL REFERENCES auth.users(id),
  vip_profil_id       UUID        NOT NULL REFERENCES public.vip_profils(id),

  -- Ce que le client demande
  space_id            UUID        REFERENCES public.restaurant_spaces(id),
  time_slot_id        UUID        REFERENCES public.restaurant_time_slots(id),
  date_reservation    DATE        NOT NULL,
  heure_debut         TIME        NOT NULL,
  nb_personnes        SMALLINT    NOT NULL CHECK (nb_personnes BETWEEN 1 AND 100),
  motif               public.table_reservation_motif,
  details_motif       TEXT,
  options_speciales   TEXT[]      NOT NULL DEFAULT '{}',
  -- valeurs acceptées dans options_speciales :
  -- 'bougie', 'emplacement_intime', 'chaise_haute', 'decoration_table'

  -- Statut
  statut              public.table_reservation_statut NOT NULL DEFAULT 'en_attente',

  -- Paiement acompte
  acompte_montant     INTEGER     NOT NULL DEFAULT 3000,   -- FCFA vers restaurant
  frais_service       INTEGER     NOT NULL DEFAULT 200,    -- FCFA commission LASSI
  montant_total       INTEGER     NOT NULL DEFAULT 3200,   -- total payé par client
  paiement_ref        TEXT,
  paiement_statut     TEXT        NOT NULL DEFAULT 'en_attente',
  paiement_methode    TEXT,                               -- 'wave' | 'orange_money'

  -- Réponse du gérant (sur accept/refuse)
  message_gerant      TEXT,

  -- Ticket numérique (généré à l'acceptation)
  qr_code             TEXT        UNIQUE,

  -- Alternative proposée par le gérant
  alt_space_id        UUID        REFERENCES public.restaurant_spaces(id),
  alt_date            DATE,
  alt_heure_debut     TIME,
  alt_message         TEXT,

  -- Validation à l'arrivée (scan QR)
  validee_a           TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. Trigger updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_table_reservations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_table_reservations_updated_at ON public.table_reservations;
CREATE TRIGGER trg_table_reservations_updated_at
  BEFORE UPDATE ON public.table_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_table_reservations();

DROP TRIGGER IF EXISTS trg_restaurant_spaces_updated_at ON public.restaurant_spaces;
CREATE TRIGGER trg_restaurant_spaces_updated_at
  BEFORE UPDATE ON public.restaurant_spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_table_reservations();

-- ─── 6. Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_table_reservations_client      ON public.table_reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_vip_profil  ON public.table_reservations(vip_profil_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_date        ON public.table_reservations(date_reservation);
CREATE INDEX IF NOT EXISTS idx_table_reservations_statut      ON public.table_reservations(statut);
CREATE INDEX IF NOT EXISTS idx_table_reservations_qr          ON public.table_reservations(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_spaces_vip          ON public.restaurant_spaces(vip_profil_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_time_slots_vip      ON public.restaurant_time_slots(vip_profil_id);

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.restaurant_spaces     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_reservations    ENABLE ROW LEVEL SECURITY;

-- restaurant_spaces : lecture publique, écriture gérant ou admin

DROP POLICY IF EXISTS "spaces_public_select"        ON public.restaurant_spaces;
DROP POLICY IF EXISTS "spaces_gerant_admin_insert"  ON public.restaurant_spaces;
DROP POLICY IF EXISTS "spaces_gerant_admin_update"  ON public.restaurant_spaces;
DROP POLICY IF EXISTS "spaces_gerant_admin_delete"  ON public.restaurant_spaces;

CREATE POLICY "spaces_public_select" ON public.restaurant_spaces
  FOR SELECT USING (true);

CREATE POLICY "spaces_gerant_admin_insert" ON public.restaurant_spaces
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "spaces_gerant_admin_update" ON public.restaurant_spaces
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "spaces_gerant_admin_delete" ON public.restaurant_spaces
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- restaurant_time_slots : même pattern

DROP POLICY IF EXISTS "time_slots_public_select"        ON public.restaurant_time_slots;
DROP POLICY IF EXISTS "time_slots_gerant_admin_insert"  ON public.restaurant_time_slots;
DROP POLICY IF EXISTS "time_slots_gerant_admin_update"  ON public.restaurant_time_slots;
DROP POLICY IF EXISTS "time_slots_gerant_admin_delete"  ON public.restaurant_time_slots;

CREATE POLICY "time_slots_public_select" ON public.restaurant_time_slots
  FOR SELECT USING (true);

CREATE POLICY "time_slots_gerant_admin_insert" ON public.restaurant_time_slots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "time_slots_gerant_admin_update" ON public.restaurant_time_slots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "time_slots_gerant_admin_delete" ON public.restaurant_time_slots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- table_reservations

DROP POLICY IF EXISTS "reservations_select"         ON public.table_reservations;
DROP POLICY IF EXISTS "reservations_client_insert"  ON public.table_reservations;
DROP POLICY IF EXISTS "reservations_update"         ON public.table_reservations;
DROP POLICY IF EXISTS "reservations_admin_delete"   ON public.table_reservations;

-- Lecture : le client voit les siennes, le gérant voit celles de son restaurant, l'admin voit tout
CREATE POLICY "reservations_select" ON public.table_reservations
  FOR SELECT USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Création : client authentifié (la validation paiement est dans l'Edge Function)
CREATE POLICY "reservations_client_insert" ON public.table_reservations
  FOR INSERT WITH CHECK (
    client_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- Mise à jour : gérant de ce restaurant, admin, ou client annulant avant traitement
CREATE POLICY "reservations_update" ON public.table_reservations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vip_profils vp WHERE vp.id = vip_profil_id AND vp.gerant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR (client_id = auth.uid() AND statut = 'en_attente')
  );

-- Suppression : admin uniquement
CREATE POLICY "reservations_admin_delete" ON public.table_reservations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ─── 8. RPC : validation QR à l'arrivée ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.valider_arrivee_reservation(
  p_qr_code         TEXT,
  p_gerant_user_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resa  public.table_reservations;
BEGIN
  SELECT * INTO v_resa
  FROM public.table_reservations
  WHERE qr_code = p_qr_code;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'QR code invalide');
  END IF;

  -- Vérifie que le gérant est bien celui de ce restaurant
  IF NOT EXISTS (
    SELECT 1 FROM public.vip_profils
    WHERE id = v_resa.vip_profil_id AND gerant_user_id = p_gerant_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF v_resa.statut <> 'acceptee' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Réservation non valide pour validation',
      'statut', v_resa.statut::TEXT
    );
  END IF;

  UPDATE public.table_reservations
  SET statut = 'arrivee', validee_a = now(), updated_at = now()
  WHERE id = v_resa.id;

  RETURN json_build_object(
    'success',          true,
    'reservation_id',   v_resa.id,
    'nb_personnes',     v_resa.nb_personnes,
    'acompte_montant',  v_resa.acompte_montant,
    'motif',            v_resa.motif::TEXT,
    'options',          v_resa.options_speciales
  );
END;
$$;

REVOKE ALL ON FUNCTION public.valider_arrivee_reservation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_arrivee_reservation TO authenticated;

-- ─── 9. RPC : créneaux disponibles pour une date ─────────────────────────────
-- Retourne les time_slots actifs du restaurant qui s'appliquent au jour demandé.

CREATE OR REPLACE FUNCTION public.get_reservation_slots(
  p_vip_profil_id UUID,
  p_date          DATE
)
RETURNS TABLE (
  slot_id     UUID,
  label       TEXT,
  heure_debut TIME,
  heure_fin   TIME
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    ts.label,
    ts.heure_debut,
    ts.heure_fin
  FROM public.restaurant_time_slots ts
  WHERE ts.vip_profil_id = p_vip_profil_id
    AND ts.actif = true
    AND (EXTRACT(DOW FROM p_date)::SMALLINT) = ANY(ts.jours_semaine)
  ORDER BY ts.position, ts.heure_debut;
$$;

REVOKE ALL ON FUNCTION public.get_reservation_slots FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reservation_slots TO anon, authenticated;

-- ─── 10. RPC : réservations du gérant (dashboard restaurant) ─────────────────

CREATE OR REPLACE FUNCTION public.get_reservations_gerant(
  p_gerant_user_id  UUID,
  p_statut          TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  date_reservation  DATE,
  heure_debut       TIME,
  nb_personnes      SMALLINT,
  motif             TEXT,
  options_speciales TEXT[],
  statut            TEXT,
  acompte_montant   INTEGER,
  created_at        TIMESTAMPTZ,
  space_nom         TEXT,
  slot_label        TEXT,
  client_nom        TEXT,
  client_tel        TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.date_reservation,
    r.heure_debut,
    r.nb_personnes,
    r.motif::TEXT,
    r.options_speciales,
    r.statut::TEXT,
    r.acompte_montant,
    r.created_at,
    s.nom        AS space_nom,
    ts.label     AS slot_label,
    pr.name  AS client_nom,
    pr.phone AS client_tel
  FROM public.table_reservations r
  JOIN public.vip_profils vp ON vp.id = r.vip_profil_id
  LEFT JOIN public.restaurant_spaces     s  ON s.id  = r.space_id
  LEFT JOIN public.restaurant_time_slots ts ON ts.id = r.time_slot_id
  LEFT JOIN public.profiles              pr ON pr.id = r.client_id
  WHERE vp.gerant_user_id = p_gerant_user_id
    AND (p_statut IS NULL OR r.statut::TEXT = p_statut)
  ORDER BY r.date_reservation ASC, r.heure_debut ASC;
$$;

REVOKE ALL ON FUNCTION public.get_reservations_gerant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reservations_gerant TO authenticated;
