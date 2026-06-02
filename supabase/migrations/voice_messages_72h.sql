-- ═══════════════════════════════════════════════════════════════════
--  LASSI — Médias chat (images + vocaux) + TTL 72 h sur les messages
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Bucket Supabase Storage ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,           -- accès public en lecture (les URLs sont non-devinables)
  15728640,       -- 15 MB max par fichier
  ARRAY[
    'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/3gpp', 'audio/mpeg', 'audio/webm',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 15728640,
  allowed_mime_types = ARRAY[
    'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/3gpp', 'audio/mpeg', 'audio/webm',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
  ];

-- ─── 2. Policies Storage RLS ────────────────────────────────────────────────

-- Lecture : tout utilisateur authentifié peut lire les médias
DO $$ BEGIN
  CREATE POLICY "chat_media_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'chat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Upload : tout utilisateur authentifié peut uploader
DO $$ BEGIN
  CREATE POLICY "chat_media_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Suppression : tout utilisateur authentifié peut supprimer (pour le cleanup)
DO $$ BEGIN
  CREATE POLICY "chat_media_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'chat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Fonction de nettoyage des messages expirés (> 72 h) ─────────────────

CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Supprimer les messages de plus de 72 heures
  DELETE FROM messages
  WHERE created_at < NOW() - INTERVAL '72 hours';

  -- Remettre à zéro les conversations dont tous les messages ont expiré
  UPDATE conversations c
  SET
    last_message    = NULL,
    client_unread   = 0,
    merchant_unread = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.conversation_id = c.id
  );
END;
$$;

-- ─── 4. Cron horaire via pg_cron (activer l'extension dans Dashboard > Extensions) ─

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Supprimer l'ancien job s'il existe, pour éviter les doublons
    PERFORM cron.unschedule('delete-expired-messages');
    PERFORM cron.schedule(
      'delete-expired-messages',
      '0 * * * *',   -- toutes les heures
      'SELECT delete_expired_messages()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;  -- pg_cron non activé : pas bloquant
END;
$$;
