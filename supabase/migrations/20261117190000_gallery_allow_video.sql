-- Vidéo de présentation vitrine (Site Builder, template Maroquinerie) : l'upload
-- échouait avec « mime type video/quicktime is not supported » car le bucket
-- 'gallery' n'autorisait que les images. On ajoute les types vidéo (iOS envoie
-- video/quicktime pour .mov, Android video/mp4) et on relève la limite de taille
-- à 30 Mo (la vidéo est déjà fortement compressée côté app : 15 s max, preset bas).
UPDATE storage.buckets
SET
  allowed_mime_types = (
    SELECT array_agg(DISTINCT m)
    FROM unnest(
      COALESCE(allowed_mime_types, ARRAY[]::text[])
      || ARRAY['video/mp4', 'video/quicktime']
    ) AS m
  ),
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 31457280)
WHERE id = 'gallery';
