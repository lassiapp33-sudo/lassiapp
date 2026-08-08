-- ===========================================================================
-- FIX : notify-new-prestataire — clients antérieurs uniquement
-- ---------------------------------------------------------------------------
-- Bug : pg_net est asynchrone. L'Edge Function s'exécutait avec un délai
-- (secondes à minutes), incluant les clients inscrits APRÈS la boutique.
-- Fix : le trigger envoie maintenant NEW.created_at (ISO 8601) à l'EF, qui
-- filtre les profils avec created_at <= shopCreatedAt.
-- ===========================================================================

CREATE OR REPLACE FUNCTION notify_new_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_srk TEXT;
BEGIN
  SELECT decrypted_secret INTO v_srk
  FROM vault.decrypted_secrets
  WHERE name = 'lassi_service_role_key'
  LIMIT 1;

  IF v_srk IS NULL THEN
    RAISE NOTICE '[notify_new_shop] lassi_service_role_key absent du Vault — notification ignorée';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/notify-new-prestataire',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_srk
    ),
    body := jsonb_build_object(
      'shopId',        NEW.id::text,
      'shopName',      NEW.name,
      'category',      COALESCE(NEW.category, ''),
      'shopCreatedAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[notify_new_shop] Erreur (%) — inscription non bloquée', SQLERRM;
  RETURN NEW;
END;
$$;

-- Le trigger reste inchangé — seule la fonction est mise à jour.
-- DROP TRIGGER IF EXISTS on_new_shop ON shops;  ← pas besoin de recréer
