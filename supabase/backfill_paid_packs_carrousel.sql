-- ===========================================================================
-- LASSİ — Backfill : insérer les packs visibilité actifs dans carrousel
-- ===========================================================================
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- après avoir appliqué la migration 20260702100000_paid_pack_carrousel.sql
--
-- Pour chaque abonnement "quartier" actif qui a des product_ids,
-- insère les produits dans carrousel_offre_quartier avec is_paid_pack = true.
-- ===========================================================================

DO $$
DECLARE
  r RECORD;
  p RECORD;
  i INT;
BEGIN
  FOR r IN
    SELECT
      vs.id          AS sub_id,
      vs.merchant_id,
      vs.shop_id,
      vs.product_ids,
      vs.all_products
    FROM visibility_subscriptions vs
    WHERE vs.status      = 'active'
      AND vs.offer_type  = 'quartier'
      AND vs.expires_at  > NOW()
  LOOP
    -- Supprimer les entrées payantes existantes pour ce marchand (éviter doublons)
    DELETE FROM carrousel_offre_quartier
    WHERE prestataire_id = r.merchant_id
      AND is_paid_pack   = true;

    IF r.all_products THEN
      -- Toute la vitrine : insérer tous les produits en stock
      i := 0;
      FOR p IN
        SELECT id, name, price, emoji, photo_url
        FROM products
        WHERE shop_id = r.shop_id
          AND stock   = 'in'
      LOOP
        INSERT INTO carrousel_offre_quartier
          (prestataire_id, product_id, nom, prix, image_url, rang_prestataire, ordre, periode, est_actif, is_paid_pack)
        VALUES
          (r.merchant_id, p.id, p.name, p.price,
           CASE WHEN p.photo_url LIKE 'http%' THEN p.photo_url ELSE COALESCE(p.emoji, '') END,
           NULL, i, 'paid', true, true)
        ON CONFLICT DO NOTHING;
        i := i + 1;
      END LOOP;

    ELSIF r.product_ids IS NOT NULL AND array_length(r.product_ids, 1) > 0 THEN
      -- Produits spécifiques
      i := 0;
      FOR p IN
        SELECT id, name, price, emoji, photo_url
        FROM products
        WHERE id = ANY(r.product_ids)
          AND shop_id = r.shop_id
      LOOP
        INSERT INTO carrousel_offre_quartier
          (prestataire_id, product_id, nom, prix, image_url, rang_prestataire, ordre, periode, est_actif, is_paid_pack)
        VALUES
          (r.merchant_id, p.id, p.name, p.price,
           CASE WHEN p.photo_url LIKE 'http%' THEN p.photo_url ELSE COALESCE(p.emoji, '') END,
           NULL, i, 'paid', true, true)
        ON CONFLICT DO NOTHING;
        i := i + 1;
      END LOOP;
    END IF;

    RAISE NOTICE 'Backfill OK — sub_id: %, merchant_id: %, all_products: %', r.sub_id, r.merchant_id, r.all_products;
  END LOOP;
END $$;

-- Vérification finale
SELECT
  coq.prestataire_id,
  coq.nom,
  coq.est_actif,
  coq.is_paid_pack,
  s.name AS shop_name
FROM carrousel_offre_quartier coq
JOIN shops s ON s.merchant_id = coq.prestataire_id
WHERE coq.is_paid_pack = true
ORDER BY coq.prestataire_id, coq.ordre;
