-- Colonne updated_at manquante en prod (table créée sans elle)
ALTER TABLE reservations_terrain
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Recréer verify_terrain_receipt sans dépendance sur updated_at
-- DROP requis car le type de retour peut différer entre versions
DROP FUNCTION IF EXISTS public.verify_terrain_receipt(text, uuid);
CREATE OR REPLACE FUNCTION public.verify_terrain_receipt(
  p_receipt_code    text,
  p_prestataire_id  uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_res public.reservations_terrain%ROWTYPE;
BEGIN
  SELECT * INTO v_res
  FROM public.reservations_terrain
  WHERE receipt_code    = p_receipt_code
    AND prestataire_id  = p_prestataire_id
    AND statut          = 'paye'
    AND receipt_status  = 'valide'
    AND receipt_valid_until > now();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Code invalide, expiré ou déjà utilisé');
  END IF;

  UPDATE public.reservations_terrain
  SET statut         = 'utilise',
      receipt_status = 'utilise',
      validated_at   = now(),
      updated_at     = now()
  WHERE id = v_res.id;

  RETURN json_build_object(
    'success',          true,
    'client_id',        v_res.client_id,
    'terrain_id',       v_res.terrain_id,
    'heure_debut',      to_char(v_res.heure_debut, 'HH24:MI'),
    'heure_fin',        to_char(v_res.heure_fin,   'HH24:MI'),
    'date_reservation', to_char(v_res.date_reservation, 'YYYY-MM-DD')
  );
END;
$$;
