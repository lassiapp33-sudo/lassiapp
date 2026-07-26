-- ===========================================================================
-- LASSI — Avis vocaux post-commande + note étoiles clients
-- ---------------------------------------------------------------------------
-- 1. Colonne vocal_url sur order_ratings (chemin Storage)
-- 2. Colonnes note_moyenne + nb_avis sur client_scores (rating clients)
-- 3. Mise à jour du RPC soumettre_note_commande (signature étendue)
-- 4. Bucket public order-vocals + policies RLS Storage
-- 5. RPC get_mes_stats_client (lecture sécurisée pour ClientProfileScreen)
-- ===========================================================================

-- ─── 1. vocal_url sur order_ratings ──────────────────────────────────────────

ALTER TABLE order_ratings
  ADD COLUMN IF NOT EXISTS vocal_url TEXT;

-- ─── 2. Note étoiles clients ──────────────────────────────────────────────────

ALTER TABLE client_scores
  ADD COLUMN IF NOT EXISTS note_moyenne NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_avis      INTEGER      NOT NULL DEFAULT 0;

-- ─── 3. Mise à jour du RPC soumettre_note_commande ───────────────────────────
-- La signature change (ajout p_vocal_url) → on REVOKE / DROP / RECREATE

REVOKE EXECUTE ON FUNCTION soumettre_note_commande(uuid, text, integer, text) FROM authenticated;
DROP FUNCTION IF EXISTS soumettre_note_commande(uuid, text, integer, text);

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
  -- Validation
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

  -- Idempotence
  IF EXISTS (
    SELECT 1 FROM order_ratings
     WHERE order_id = p_order_id AND direction = p_direction
  ) THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  -- Insérer la note (avec vocal_url optionnel)
  INSERT INTO order_ratings (order_id, rater_id, rated_id, direction, note, commentaire, vocal_url)
  VALUES (p_order_id, v_rater_id, v_rated_id, p_direction, p_note, p_commentaire, p_vocal_url);

  -- Barème bonus : ≥4 ★ → +5 pts, 3 ★ → +2 pts, <3 → 0 pt
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
    -- merchant_to_client : bonus points + note étoiles du client
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

-- ─── 4. Bucket public order-vocals ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-vocals',
  'order-vocals',
  true,
  10485760,
  ARRAY['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/3gpp']
)
ON CONFLICT (id) DO NOTHING;

-- Seul l'auteur peut uploader dans son dossier
DROP POLICY IF EXISTS "order_vocals_insert" ON storage.objects;
CREATE POLICY "order_vocals_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-vocals' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tout utilisateur authentifié peut lire (prestataire entend l'avis du client, et vice versa)
DROP POLICY IF EXISTS "order_vocals_select" ON storage.objects;
CREATE POLICY "order_vocals_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-vocals');

-- L'auteur peut supprimer ses propres fichiers
DROP POLICY IF EXISTS "order_vocals_delete" ON storage.objects;
CREATE POLICY "order_vocals_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-vocals' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 5. RPC get_mes_stats_client ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mes_stats_client()
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'note_moyenne', cs.note_moyenne,
        'nb_avis',      cs.nb_avis,
        'points_mois',  cs.points_mois
      )
      FROM client_scores cs
      WHERE cs.client_id = auth.uid()
    ),
    '{"note_moyenne": 0, "nb_avis": 0, "points_mois": 0}'::jsonb
  );
$$;

REVOKE EXECUTE ON FUNCTION get_mes_stats_client() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_mes_stats_client() TO authenticated;

NOTIFY pgrst, 'reload schema';
