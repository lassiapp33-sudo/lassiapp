-- ===========================================================================
-- LASSI — Fix RLS bucket "gallery" : upload photos de terrains
-- ---------------------------------------------------------------------------
-- Bug : TerrainEditScreen uploade les photos de terrain dans le bucket
-- "gallery" sous le chemin terrains/{prestataire_id}/xxx.jpg
-- (cf. Lassi/src/screens/merchant/TerrainEditScreen.tsx), mais la policy
-- "Upload gallery propriétaire" (Lassi/supabase_gallery_bucket.sql)
-- n'autorise que les chemins {shop_id}/... où shop_id appartient au
-- commerçant connecté (table shops).
-- => "Erreur - Upload échoué : new row violates row-level security policy"
-- lors de l'ajout de photos sur un terrain.
--
-- Fix : nouvelles policies INSERT/UPDATE/DELETE pour le préfixe
-- terrains/{auth.uid()}/... — le prestataire ne peut gérer que ses propres
-- photos de terrain. S'ajoutent (OR) aux policies existantes sans les
-- modifier, donc l'upload galerie boutique reste inchangé.
-- ===========================================================================

DROP POLICY IF EXISTS "Upload gallery terrain" ON storage.objects;
CREATE POLICY "Upload gallery terrain" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = 'terrains'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Modif gallery terrain" ON storage.objects;
CREATE POLICY "Modif gallery terrain" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = 'terrains'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Suppr gallery terrain" ON storage.objects;
CREATE POLICY "Suppr gallery terrain" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = 'terrains'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
