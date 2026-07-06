-- ===========================================================================
-- VOICE NOTES : message vocal optionnel joint à une commande
-- ---------------------------------------------------------------------------
-- 1. Colonne voice_note_url sur orders (chemin Supabase Storage)
-- 2. Bucket privé « voice-notes »
-- 3. Policies RLS Storage
-- ===========================================================================

-- ① Colonne sur la table orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS voice_note_url TEXT;

-- ② Bucket privé (10 Mo max, formats audio uniquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  10485760,
  ARRAY['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/3gpp', 'audio/aac', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- ③ Policies Storage

-- Le client peut uploader dans son propre dossier (format : {user_id}/*)
CREATE POLICY "voice_notes_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tout utilisateur authentifié peut lire (prestataires inclus)
CREATE POLICY "voice_notes_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-notes');

-- Le client peut supprimer ses propres fichiers
CREATE POLICY "voice_notes_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-notes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
