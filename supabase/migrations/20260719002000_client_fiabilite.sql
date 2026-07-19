-- ===========================================================================
-- LASSI — Note de Fiabilité Client (NFC)
-- ---------------------------------------------------------------------------
-- Le prestataire donne 1★ (peu sérieux) ou 5★ (sérieux) à chaque commande.
-- La moyenne mobile s'accumule dans client_scores.note_moyenne / nb_avis.
-- Les marchands peuvent lire les scores en batch via get_clients_scores().
-- ===========================================================================

-- ─── 1. Restreindre merchant_to_client à 1 ou 5 étoiles ──────────────────────
-- On DROP + RECREATE la fonction (même signature) pour éviter PGRST203.

REVOKE EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text, text) FROM authenticated;
DROP FUNCTION IF EXISTS soumettre_note_commande(uuid, text, integer, text, text);

CREATE FUNCTION soumettre_note_commande(
  p_order_id    uuid,
  p_direction   text,
  p_note        integer,
  p_commentaire text DEFAULT NULL,
  p_vocal_url   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_shop_id     uuid;
  v_merchant_id uuid;
  v_rater_id    uuid := auth.uid();
  v_rated_id    uuid;
  v_bonus_pts   integer;
BEGIN
  -- Validation de la direction
  IF p_direction NOT IN ('client_to_merchant', 'merchant_to_client') THEN
    RAISE EXCEPTION 'direction invalide';
  END IF;

  -- Note client : seulement 1 (peu sérieux) ou 5 (sérieux)
  IF p_direction = 'merchant_to_client' AND p_note NOT IN (1, 5) THEN
    RAISE EXCEPTION 'note client invalide : seulement 1 ou 5 étoiles';
  END IF;

  IF p_note NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'note invalide';
  END IF;
  IF p_commentaire IS NOT NULL AND char_length(p_commentaire) > 200 THEN
    RAISE EXCEPTION 'commentaire trop long';
  END IF;

  -- Récupérer la commande
  SELECT o.client_id, o.shop_id
    INTO v_client_id, v_shop_id
    FROM orders o
   WHERE o.id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'commande introuvable';
  END IF;

  -- Récupérer le marchand du shop
  SELECT merchant_id INTO v_merchant_id
    FROM shops
   WHERE id = v_shop_id;

  -- Vérifier permissions et déterminer l'identité du noté
  IF p_direction = 'client_to_merchant' THEN
    IF v_client_id IS DISTINCT FROM v_rater_id THEN
      RAISE EXCEPTION 'non autorisé';
    END IF;
    v_rated_id := v_merchant_id;
  ELSE
    IF v_merchant_id IS DISTINCT FROM v_rater_id THEN
      RAISE EXCEPTION 'non autorisé';
    END IF;
    v_rated_id := v_client_id;
  END IF;

  -- Idempotence : une seule note par sens par commande
  IF EXISTS (
    SELECT 1 FROM order_ratings
     WHERE order_id = p_order_id AND direction = p_direction
  ) THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  -- Insérer la note
  INSERT INTO order_ratings (order_id, rater_id, rated_id, direction, note, commentaire, vocal_url)
  VALUES (p_order_id, v_rater_id, v_rated_id, p_direction, p_note, p_commentaire, p_vocal_url);

  -- Barème bonus : ≥4★ → +5 pts, 3★ → +2 pts, <3 → 0 pt
  v_bonus_pts := CASE
    WHEN p_note >= 4 THEN 5
    WHEN p_note = 3  THEN 2
    ELSE 0
  END;

  IF p_direction = 'client_to_merchant' THEN
    UPDATE prestataire_scores
       SET nb_avis        = nb_avis + 1,
           note_moyenne   = (note_moyenne * nb_avis + p_note::numeric) / (nb_avis + 1),
           points_semaine = points_semaine + v_bonus_pts,
           points_mois    = points_mois    + v_bonus_pts,
           updated_at     = now()
     WHERE prestataire_id = v_rated_id;
  ELSE
    -- merchant_to_client : bonus points + mise à jour note de fiabilité client
    UPDATE client_scores
       SET points_semaine = points_semaine + v_bonus_pts,
           points_mois    = points_mois    + v_bonus_pts,
           nb_avis        = nb_avis + 1,
           note_moyenne   = (note_moyenne * nb_avis + p_note::numeric) / (nb_avis + 1),
           updated_at     = now()
     WHERE client_id = v_rated_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'skipped', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text, text) TO authenticated;

-- ─── 2. Lecture batch des scores clients (pour les prestataires) ──────────────
-- Permet aux marchands de lire les notes de plusieurs clients en une seule requête.
-- RLS bypassée car les scores sont publics entre utilisateurs authentifiés.

CREATE OR REPLACE FUNCTION get_clients_scores(p_client_ids uuid[])
RETURNS TABLE(client_id uuid, note_moyenne numeric, nb_avis integer)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.client_id, cs.note_moyenne, cs.nb_avis
  FROM client_scores cs
  WHERE cs.client_id = ANY(p_client_ids)
    AND cs.nb_avis > 0;
$$;

REVOKE EXECUTE ON FUNCTION get_clients_scores(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_clients_scores(uuid[]) TO authenticated;

-- ─── 3. verify_receipt : inclure le score de fiabilité du client ──────────────

CREATE OR REPLACE FUNCTION verify_receipt(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id      uuid;
  v_client_id     uuid;
  v_status        text;
  v_valid_until   timestamptz;
  v_total         numeric;
  v_client_name   text;
  v_client_score  numeric;
  v_client_nb     integer;
BEGIN
  -- Trouve et verrouille la commande (appartenant à une boutique du prestataire connecté)
  SELECT o.id, o.receipt_status, o.receipt_valid_until, o.total, o.client_id
    INTO v_order_id, v_status, v_valid_until, v_total, v_client_id
    FROM orders o
   WHERE o.receipt_code = upper(trim(p_code))
     AND o.shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid())
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'introuvable');
  END IF;

  -- Expiration paresseuse
  IF v_status = 'valide' AND now() >= v_valid_until THEN
    UPDATE orders SET receipt_status = 'expire' WHERE id = v_order_id;
    RETURN jsonb_build_object('success', false, 'reason', 'expire');
  END IF;

  IF v_status = 'utilise' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'deja_utilise');
  END IF;

  IF v_status != 'valide' THEN
    RETURN jsonb_build_object('success', false, 'reason', COALESCE(v_status, 'aucun'));
  END IF;

  -- Marquage atomique : utilisé + commande terminée
  UPDATE orders
     SET receipt_status = 'utilise',
         status         = 'done'
   WHERE id             = v_order_id
     AND receipt_status = 'valide';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'deja_utilise');
  END IF;

  -- Nom du client (best-effort)
  SELECT name INTO v_client_name FROM profiles WHERE id = v_client_id;

  -- Score de fiabilité du client (peut être NULL si pas encore noté)
  SELECT cs.note_moyenne, cs.nb_avis
    INTO v_client_score, v_client_nb
    FROM client_scores cs
   WHERE cs.client_id = v_client_id
     AND cs.nb_avis > 0;

  RETURN jsonb_build_object(
    'success',          true,
    'total',            v_total,
    'client_name',      COALESCE(v_client_name, 'Client'),
    'client_score',     v_client_score,
    'client_nb_notes',  v_client_nb
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
