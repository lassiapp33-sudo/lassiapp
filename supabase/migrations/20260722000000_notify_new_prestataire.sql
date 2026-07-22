-- ===========================================================================
-- LASSI — Notification automatique nouveau prestataire
-- Migration 2026-07-22
-- ---------------------------------------------------------------------------
-- À chaque nouvel INSERT dans shops, un trigger appelle l'Edge Function
-- notify-new-prestataire via pg_net (non-bloquant). La fonction :
--   1. Insère une annonce in-app (audience = 'clients', tag = shopId)
--   2. Envoie un push FCM à tous les clients via Expo Push API
--
-- ⚠️ PRÉREQUIS — à exécuter UNE SEULE FOIS dans Supabase Dashboard >
-- SQL Editor (ne jamais committer la clé service_role) :
--
--   SELECT vault.create_secret(
--     'VOTRE_SUPABASE_SERVICE_ROLE_KEY',
--     'lassi_service_role_key',
--     'Service role key pour appels internes depuis triggers SQL'
--   );
--
-- Puis déployer l'Edge Function :
--   supabase functions deploy notify-new-prestataire
-- ===========================================================================

-- ─── 1. Activer pg_net si nécessaire ─────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net non activé automatiquement (%) — activer via Dashboard > Database > Extensions', SQLERRM;
END $$;

-- ─── 2. Fonction trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_srk TEXT;
BEGIN
  -- Lire la service_role_key depuis Vault (jamais en clair dans le code)
  SELECT decrypted_secret INTO v_srk
  FROM vault.decrypted_secrets
  WHERE name = 'lassi_service_role_key'
  LIMIT 1;

  IF v_srk IS NULL THEN
    RAISE NOTICE '[notify_new_shop] lassi_service_role_key absent du Vault — notification ignorée';
    RETURN NEW;
  END IF;

  -- Appel HTTP asynchrone via pg_net (ne bloque pas l'INSERT)
  PERFORM net.http_post(
    url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/notify-new-prestataire',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_srk
    ),
    body := jsonb_build_object(
      'shopId',    NEW.id::text,
      'shopName',  NEW.name,
      'category',  COALESCE(NEW.category, '')
    )
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'une boutique si la notification échoue
  RAISE NOTICE '[notify_new_shop] Erreur (%) — inscription non bloquée', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── 3. Trigger sur shops (AFTER INSERT) ─────────────────────────────────────
DROP TRIGGER IF EXISTS on_new_shop ON shops;
CREATE TRIGGER on_new_shop
  AFTER INSERT ON shops
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_shop();
