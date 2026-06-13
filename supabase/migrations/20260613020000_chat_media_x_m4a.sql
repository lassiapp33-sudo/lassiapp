-- Le bucket chat-media rejetait les messages vocaux iOS : iOS envoie
-- "audio/x-m4a" pour les fichiers .m4a (au lieu de "audio/mp4" demandé
-- côté app), ce qui causait "Storage upload: mime type audio/x-m4a is
-- not supported".
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/x-m4a')
WHERE id = 'chat-media'
  AND NOT ('audio/x-m4a' = ANY(allowed_mime_types));
