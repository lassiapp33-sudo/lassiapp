-- ===========================================================================
-- LASSİ — Système d'avis clients
-- 1 avis par client par prestataire (pas de commande obligatoire)
-- SAFE à re-exécuter
-- ===========================================================================

-- ─── 1. TABLE ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avis (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID        REFERENCES orders(id) ON DELETE SET NULL,
  shop_id            UUID        NOT NULL REFERENCES shops(id)      ON DELETE CASCADE,
  author_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name        TEXT        NOT NULL DEFAULT '',
  note               INTEGER     NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire        TEXT        CHECK (char_length(commentaire) <= 500),
  photo_url          TEXT,
  reponse_commercant TEXT        CHECK (char_length(reponse_commercant) <= 500),
  masque             BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_avis_shop_id ON avis (shop_id) WHERE NOT masque;
CREATE INDEX IF NOT EXISTS idx_avis_author  ON avis (author_id);

-- ─── 2. BUCKET STORAGE ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avis', 'avis', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avis_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "avis_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "avis_storage_delete" ON storage.objects;

CREATE POLICY "avis_storage_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avis');

CREATE POLICY "avis_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avis');

CREATE POLICY "avis_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avis' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE avis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avis_select"          ON avis;
DROP POLICY IF EXISTS "avis_insert"          ON avis;
DROP POLICY IF EXISTS "avis_update_author"   ON avis;
DROP POLICY IF EXISTS "avis_update_merchant" ON avis;
DROP POLICY IF EXISTS "avis_update_admin"    ON avis;
DROP POLICY IF EXISTS "avis_delete"          ON avis;

-- SELECT : avis non masqués + les propres avis + admin voit tout
CREATE POLICY "avis_select"
  ON avis FOR SELECT
  USING (
    NOT masque
    OR auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- INSERT : client connecté ayant une commande 'done' chez ce prestataire (anti-fraude)
CREATE POLICY "avis_insert"
  ON avis FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.client_id = auth.uid()
        AND orders.shop_id   = avis.shop_id
        AND orders.status    = 'done'
    )
  );

-- UPDATE auteur : modifier son propre avis (note / commentaire / photo)
CREATE POLICY "avis_update_author"
  ON avis FOR UPDATE TO authenticated
  USING  (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- UPDATE prestataire : répondre à un avis de sa vitrine
CREATE POLICY "avis_update_merchant"
  ON avis FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM shops WHERE id = avis.shop_id AND merchant_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE id = avis.shop_id AND merchant_id = auth.uid())
  );

-- UPDATE admin : masquer/démasquer un avis
CREATE POLICY "avis_update_admin"
  ON avis FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- DELETE : auteur ou admin
CREATE POLICY "avis_delete"
  ON avis FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── 4. TRIGGER : updated_at automatique ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_avis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_updated_at ON avis;
CREATE TRIGGER trg_avis_updated_at
  BEFORE UPDATE ON avis
  FOR EACH ROW
  EXECUTE FUNCTION fn_avis_updated_at();

-- ─── 5. TRIGGER : recalcul note + reviews_count du shop ──────────────────────

CREATE OR REPLACE FUNCTION fn_update_shop_rating_from_avis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id      uuid;
  v_avg_note     float;
  v_review_count int;
  v_orders_count int;
BEGIN
  v_shop_id := COALESCE(NEW.shop_id, OLD.shop_id);

  SELECT
    COUNT(*)           FILTER (WHERE NOT masque),
    COALESCE(AVG(note::float) FILTER (WHERE NOT masque), 0.0)
  INTO v_review_count, v_avg_note
  FROM avis
  WHERE shop_id = v_shop_id;

  SELECT COALESCE(orders_count, 0)
  INTO v_orders_count
  FROM shops WHERE id = v_shop_id;

  UPDATE shops
  SET
    reviews_count = v_review_count,
    rating        = compute_shop_rating(v_orders_count, v_review_count, v_avg_note)
  WHERE id = v_shop_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_rating ON avis;
CREATE TRIGGER trg_avis_rating
  AFTER INSERT OR UPDATE OR DELETE ON avis
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_shop_rating_from_avis();

-- ─── 6. RECHARGEMENT ─────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
