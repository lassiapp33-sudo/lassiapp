-- ===========================================================================
-- LASSI — Notes mutuelles post-commande
-- ---------------------------------------------------------------------------
-- Système de notation bidirectionnel déclenché juste après validation du
-- paiement : le client note le prestataire, le prestataire note le client.
-- Les notes alimentent les classements via bonus de points dans
-- prestataire_scores (live mondial/sous-cat) et client_scores (live clients).
-- ===========================================================================

-- ─── Table order_ratings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_ratings (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rater_id    uuid        NOT NULL REFERENCES auth.users(id),
  rated_id    uuid        NOT NULL REFERENCES auth.users(id),
  direction   text        NOT NULL CHECK (direction IN ('client_to_merchant', 'merchant_to_client')),
  note        integer     NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire text        CHECK (char_length(commentaire) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, direction)
);

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;

-- Le noteur et le noté peuvent consulter la note
DROP POLICY IF EXISTS "rating_own_select" ON order_ratings;
CREATE POLICY "rating_own_select" ON order_ratings
  FOR SELECT USING (rater_id = auth.uid() OR rated_id = auth.uid());

-- Pas de INSERT direct — uniquement via la fonction RPC SECURITY DEFINER

-- ─── RPC soumettre_note_commande ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION soumettre_note_commande(
  p_order_id    uuid,
  p_direction   text,
  p_note        integer,
  p_commentaire text DEFAULT NULL
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
  -- Validation des paramètres
  IF p_direction NOT IN ('client_to_merchant', 'merchant_to_client') THEN
    RAISE EXCEPTION 'direction invalide';
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
  INSERT INTO order_ratings (order_id, rater_id, rated_id, direction, note, commentaire)
  VALUES (p_order_id, v_rater_id, v_rated_id, p_direction, p_note, p_commentaire);

  -- Barème bonus : ≥4 ★ → +5 pts, 3 ★ → +2 pts, <3 → 0 pt
  v_bonus_pts := CASE
    WHEN p_note >= 4 THEN 5
    WHEN p_note = 3  THEN 2
    ELSE 0
  END;

  -- Mettre à jour les scores de classement
  IF p_direction = 'client_to_merchant' THEN
    -- Mettre à jour nb_avis, note_moyenne et bonus points dans prestataire_scores.
    -- (note_moyenne * nb_avis + p_note) / (nb_avis + 1) utilise les valeurs
    -- PRÉ-update dans le SET Postgres — formule correcte pour moyenne mobile.
    UPDATE prestataire_scores
       SET nb_avis        = nb_avis + 1,
           note_moyenne   = (note_moyenne * nb_avis + p_note::numeric) / (nb_avis + 1),
           points_semaine = points_semaine + v_bonus_pts,
           points_mois    = points_mois    + v_bonus_pts,
           updated_at     = now()
     WHERE prestataire_id = v_rated_id;
  ELSE
    -- Bonus points dans client_scores (live classement clients)
    UPDATE client_scores
       SET points_semaine = points_semaine + v_bonus_pts,
           points_mois    = points_mois    + v_bonus_pts,
           updated_at     = now()
     WHERE client_id = v_rated_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'skipped', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
