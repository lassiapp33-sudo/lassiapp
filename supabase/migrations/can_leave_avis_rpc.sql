-- ===========================================================================
-- RPC can_leave_avis(p_shop_id)
-- Vérifie côté serveur (source de vérité) si l'utilisateur connecté peut
-- laisser un avis sur ce prestataire :
--   • a une commande status='done' chez ce shop (anti-fraude)
--   • n'a pas encore laissé d'avis (ou retourne l'avis existant pour édition)
-- SAFE à re-exécuter (CREATE OR REPLACE).
-- ===========================================================================

CREATE OR REPLACE FUNCTION can_leave_avis(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_has_done_order BOOLEAN;
  v_existing avis%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('can_leave', false, 'reason', 'unauthenticated');
  END IF;

  -- ① L'utilisateur a-t-il une commande terminée chez ce prestataire ?
  SELECT EXISTS(
    SELECT 1 FROM orders
    WHERE client_id = v_uid
      AND shop_id   = p_shop_id
      AND status    = 'done'
  ) INTO v_has_done_order;

  -- ② A-t-il déjà laissé un avis ?
  SELECT * INTO v_existing
  FROM avis
  WHERE author_id = v_uid
    AND shop_id   = p_shop_id
  LIMIT 1;

  IF FOUND THEN
    -- Avis existant → pas de création possible, mais édition permise
    RETURN jsonb_build_object(
      'can_leave',            false,
      'reason',               'already_reviewed',
      'existing_id',          v_existing.id,
      'existing_note',        v_existing.note,
      'existing_commentaire', v_existing.commentaire,
      'existing_photo_url',   v_existing.photo_url,
      'existing_author_name', v_existing.author_name,
      'existing_created_at',  v_existing.created_at,
      'existing_updated_at',  v_existing.updated_at,
      'existing_masque',      v_existing.masque
    );
  END IF;

  IF NOT v_has_done_order THEN
    -- Pas de commande done → bloqué
    RETURN jsonb_build_object('can_leave', false, 'reason', 'no_done_order');
  END IF;

  -- Tout bon → peut créer un avis
  RETURN jsonb_build_object('can_leave', true, 'reason', 'ok');
END;
$$;

-- ===========================================================================
-- ROLLBACK
-- DROP FUNCTION IF EXISTS can_leave_avis(UUID);
-- ===========================================================================
