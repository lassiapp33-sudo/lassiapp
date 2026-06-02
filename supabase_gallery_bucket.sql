-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  LASSI — Bucket "gallery" pour photos de vitrine                   ║
-- ║  Coller dans : Supabase Dashboard → SQL Editor → New Query → Run  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ─── Créer le bucket gallery (public) ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  10485760,   -- 10 Mo max par photo
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Lecture publique ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Lecture publique gallery" ON storage.objects
    FOR SELECT USING (bucket_id = 'gallery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Upload galerie : commerçant → uniquement pour sa propre boutique ─────────
-- Format du chemin : gallery/{shop_id}/photo_{timestamp}.jpg
DO $$ BEGIN
  CREATE POLICY "Upload gallery propriétaire" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'gallery'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM shops WHERE merchant_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Modif gallery propriétaire" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'gallery'
      AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM shops WHERE merchant_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Suppr gallery propriétaire" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'gallery'
      AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM shops WHERE merchant_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
