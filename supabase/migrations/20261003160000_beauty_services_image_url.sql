-- Ajoute le champ image optionnel sur les services beauté
ALTER TABLE beauty_services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Bucket public pour les photos de services beauté
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beauty',
  'beauty',
  true,
  5242880,  -- 5 Mo max
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS : lecture publique
CREATE POLICY IF NOT EXISTS "beauty public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'beauty');

-- RLS : upload authentifié uniquement
CREATE POLICY IF NOT EXISTS "beauty auth upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'beauty');

-- RLS : mise à jour par l'auteur
CREATE POLICY IF NOT EXISTS "beauty auth update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'beauty');
