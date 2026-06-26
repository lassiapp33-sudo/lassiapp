-- ===========================================================================
-- SECURITE : log_audit_event — REVOKE FROM authenticated
-- ---------------------------------------------------------------------------
-- Problème : GRANT EXECUTE ON FUNCTION log_audit_event(...) TO authenticated
-- permettait à n'importe quel utilisateur connecté d'injecter des entrées
-- arbitraires dans audit_log via PostgREST, invalidant l'audit trail.
-- Fix : accès réservé à service_role uniquement (Edge Functions internes).
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.log_audit_event(
  TEXT, TEXT, UUID, JSONB, JSONB, JSONB
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(
  TEXT, TEXT, UUID, JSONB, JSONB, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_audit_event(
  TEXT, TEXT, UUID, JSONB, JSONB, JSONB
) TO service_role;

-- ===========================================================================
-- SECURITE : check_rate_limit — révoquer l'accès PUBLIC si accordé
-- La fonction est appelée uniquement depuis les Edge Functions (service_role).
-- Elle ne doit pas être exposée directement via PostgREST.
-- ===========================================================================

DO $$
BEGIN
  -- Révoquer seulement si la fonction existe (idempotent)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_rate_limit'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role';
  END IF;
END
$$;
