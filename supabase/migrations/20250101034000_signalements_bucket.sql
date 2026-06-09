-- ─── Bucket Storage : captures d'écran des signalements ──────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signalements',
  'signalements',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = false,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Suppression propre de toutes les anciennes policies ─────────────────────

DROP POLICY IF EXISTS "signalements_upload"       ON storage.objects;
DROP POLICY IF EXISTS "signalements_update"       ON storage.objects;
DROP POLICY IF EXISTS "signalements_admin_read"   ON storage.objects;
DROP POLICY IF EXISTS "signalements_owner_delete" ON storage.objects;

-- ─── Policies RLS ─────────────────────────────────────────────────────────────

-- Tout utilisateur authentifié peut uploader dans ce bucket
CREATE POLICY "signalements_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signalements');

-- Seul l'admin peut lire les captures
CREATE POLICY "signalements_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signalements'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- L'utilisateur peut supprimer ses propres captures
CREATE POLICY "signalements_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'signalements'
    AND SPLIT_PART(name, '/', 1) = auth.uid()::text
  );
