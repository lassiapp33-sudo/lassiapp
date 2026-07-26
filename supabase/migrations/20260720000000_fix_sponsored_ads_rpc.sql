-- ============================================================
-- Fix : incrementer_vue_annonce et incrementer_contact_annonce
-- RETURNS VOID en LANGUAGE sql ne passait pas via PostgREST.
-- Changé en RETURNS INTEGER / plpgsql pour compatibilité.
-- Migration 2026-07-20
-- ============================================================

DROP FUNCTION IF EXISTS incrementer_vue_annonce(UUID);
CREATE OR REPLACE FUNCTION incrementer_vue_annonce(p_ad_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE sponsored_ads
  SET actual_views = actual_views + 1
  WHERE id = p_ad_id AND status = 'active' AND expires_at > now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION incrementer_vue_annonce(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION incrementer_vue_annonce(UUID) TO authenticated;

DROP FUNCTION IF EXISTS incrementer_contact_annonce(UUID);
CREATE OR REPLACE FUNCTION incrementer_contact_annonce(p_ad_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE sponsored_ads
  SET contact_count = contact_count + 1
  WHERE id = p_ad_id AND status = 'active' AND expires_at > now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION incrementer_contact_annonce(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION incrementer_contact_annonce(UUID) TO authenticated;
