CREATE OR REPLACE FUNCTION public.storage_bucket_sizes()
RETURNS TABLE(bucket_id text, nb bigint, mb numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    bucket_id,
    COUNT(*)::bigint AS nb,
    ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 1) AS mb
  FROM storage.objects
  WHERE metadata->>'size' IS NOT NULL
  GROUP BY bucket_id
  ORDER BY mb DESC;
$$;
