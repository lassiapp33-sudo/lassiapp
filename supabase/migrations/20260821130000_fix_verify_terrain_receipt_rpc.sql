-- Fix verify_terrain_receipt : retire updated_at (colonne inexistante sur reservations_terrain)
-- validated_at suffit pour tracer la date de validation

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
  SET receipt_status = 'utilise', statut = 'utilise', validated_at = now()
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
