-- ============================================================
-- Module : Prise de rendez-vous — Beauté/Tressage & Coiffure (5 Étoiles)
-- Tables : beauty_time_slots, beauty_appointments
-- RPCs   : get_beauty_slots, get_beauty_appointments_gerant
-- ============================================================

-- ── 1. Créneaux configurés par le gérant ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS beauty_time_slots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_profil_id   UUID        NOT NULL REFERENCES vip_profils(id) ON DELETE CASCADE,
  label           TEXT        NOT NULL,
  heure_debut     TIME        NOT NULL,
  heure_fin       TIME        NOT NULL,
  jours_semaine   INT[]       NOT NULL DEFAULT '{1,2,3,4,5,6}', -- 0=dim 1=lun … 6=sam
  max_reservations INT        NOT NULL DEFAULT 1 CHECK (max_reservations >= 1 AND max_reservations <= 20),
  actif           BOOLEAN     NOT NULL DEFAULT TRUE,
  position        INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE beauty_time_slots ENABLE ROW LEVEL SECURITY;

-- Le gérant lit ses propres créneaux
CREATE POLICY "gerant_own_beauty_slots" ON beauty_time_slots
  FOR ALL USING (
    vip_profil_id IN (
      SELECT id FROM vip_profils WHERE gerant_user_id = auth.uid()
    )
  );

-- Les clients lisent les créneaux actifs
CREATE POLICY "client_read_active_beauty_slots" ON beauty_time_slots
  FOR SELECT USING (actif = TRUE);

-- ── 2. Rendez-vous ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beauty_appointments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vip_profil_id   UUID        NOT NULL REFERENCES vip_profils(id) ON DELETE CASCADE,
  time_slot_id    UUID        REFERENCES beauty_time_slots(id) ON DELETE SET NULL,
  prestation_nom  TEXT,
  date_rdv        DATE        NOT NULL,
  heure_debut     TIME        NOT NULL,
  heure_fin       TIME,
  note_client     TEXT        CHECK (LENGTH(note_client) <= 500),
  statut          TEXT        NOT NULL DEFAULT 'en_attente'
                              CHECK (statut IN ('en_attente','confirme','refuse','annule','termine')),
  message_gerant  TEXT        CHECK (LENGTH(message_gerant) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE beauty_appointments ENABLE ROW LEVEL SECURITY;

-- Le client voit ses propres RDV
CREATE POLICY "client_own_beauty_rdv" ON beauty_appointments
  FOR ALL USING (client_id = auth.uid());

-- Le gérant voit les RDV de son établissement
CREATE POLICY "gerant_read_beauty_rdv" ON beauty_appointments
  FOR ALL USING (
    vip_profil_id IN (
      SELECT id FROM vip_profils WHERE gerant_user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_beauty_appointment_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_beauty_appointment_updated
  BEFORE UPDATE ON beauty_appointments
  FOR EACH ROW EXECUTE FUNCTION update_beauty_appointment_ts();

-- ── 3. RPC : créneaux disponibles pour une date ───────────────────────────────

CREATE OR REPLACE FUNCTION get_beauty_slots(
  p_vip_profil_id UUID,
  p_date          DATE
)
RETURNS TABLE (
  slot_id       UUID,
  label         TEXT,
  heure_debut   TEXT,
  heure_fin     TEXT,
  dispo          INT,
  max_resa       INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jour_semaine INT;
BEGIN
  v_jour_semaine := EXTRACT(DOW FROM p_date)::INT; -- 0=dim … 6=sam

  RETURN QUERY
  SELECT
    s.id                        AS slot_id,
    s.label,
    TO_CHAR(s.heure_debut, 'HH24:MI') AS heure_debut,
    TO_CHAR(s.heure_fin,   'HH24:MI') AS heure_fin,
    GREATEST(0,
      s.max_reservations - COUNT(a.id)::INT
    )::INT                      AS dispo,
    s.max_reservations          AS max_resa
  FROM beauty_time_slots s
  LEFT JOIN beauty_appointments a
    ON  a.time_slot_id  = s.id
    AND a.date_rdv      = p_date
    AND a.statut NOT IN ('refuse', 'annule')
  WHERE s.vip_profil_id  = p_vip_profil_id
    AND s.actif           = TRUE
    AND v_jour_semaine    = ANY(s.jours_semaine)
  GROUP BY s.id, s.label, s.heure_debut, s.heure_fin, s.max_reservations, s.position
  HAVING GREATEST(0, s.max_reservations - COUNT(a.id)::INT) > 0
  ORDER BY s.position, s.heure_debut;
END;
$$;

GRANT EXECUTE ON FUNCTION get_beauty_slots(UUID, DATE) TO authenticated;

-- ── 4. RPC : liste des RDV pour le gérant ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_beauty_appointments_gerant(
  p_gerant_user_id UUID,
  p_statut         TEXT DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  date_rdv       DATE,
  heure_debut    TEXT,
  heure_fin      TEXT,
  prestation_nom TEXT,
  note_client    TEXT,
  statut         TEXT,
  message_gerant TEXT,
  created_at     TIMESTAMPTZ,
  client_nom     TEXT,
  client_tel     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.date_rdv,
    TO_CHAR(a.heure_debut, 'HH24:MI') AS heure_debut,
    TO_CHAR(a.heure_fin,   'HH24:MI') AS heure_fin,
    a.prestation_nom,
    a.note_client,
    a.statut,
    a.message_gerant,
    a.created_at,
    COALESCE(p.full_name, p.display_name, 'Client')::TEXT AS client_nom,
    p.phone::TEXT                                          AS client_tel
  FROM beauty_appointments a
  JOIN vip_profils vp
    ON vp.id = a.vip_profil_id
   AND vp.gerant_user_id = p_gerant_user_id
  LEFT JOIN profiles p ON p.id = a.client_id
  WHERE (p_statut IS NULL OR a.statut = p_statut)
  ORDER BY a.date_rdv DESC, a.heure_debut DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_beauty_appointments_gerant(UUID, TEXT) TO authenticated;
