-- ============================================================
-- LASSI — Nettoyage automatique des vieux push tokens
-- Garde les 3 tokens les plus récents par user (updated_at DESC).
-- Évite l'accumulation de tokens périmés (ex-builds, réinstalls).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_push_tokens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.push_tokens
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.push_tokens
      WHERE user_id = NEW.user_id
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 3
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_push_tokens ON public.push_tokens;

CREATE TRIGGER trg_cleanup_push_tokens
AFTER INSERT OR UPDATE ON public.push_tokens
FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_push_tokens();

-- Nettoyage immédiat des tokens existants (garder 3 par user)
DO $cleanup$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.push_tokens
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST) AS rn
      FROM public.push_tokens
    ) ranked
    WHERE rn > 3
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[lassi] push_tokens nettoyés : % tokens supprimés', v_deleted;
END $cleanup$;
