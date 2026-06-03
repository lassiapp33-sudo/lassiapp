-- ===========================================================================
-- LASSI — Rétablissement anti-fraude avis
-- Un avis n'est autorisé que si le client a une commande status='done'
-- chez ce prestataire.
-- SAFE à re-exécuter.
-- ===========================================================================

-- ① Rétablir la politique INSERT avec vérification de commande terminée
DROP POLICY IF EXISTS "avis_insert" ON avis;

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

-- ② Supprimer les avis frauduleux : ceux pour lesquels aucune commande
--    de cet auteur chez cette boutique n'existe (peu importe le statut).
--    Conservation des avis où une commande existe (même en cours) = bénéfice du doute.
DELETE FROM avis
WHERE NOT EXISTS (
  SELECT 1 FROM orders
  WHERE orders.client_id = avis.author_id
    AND orders.shop_id   = avis.shop_id
);

-- ===========================================================================
-- ROLLBACK
-- DELETE FROM avis;  -- vider si besoin, puis ré-importer
-- DROP POLICY IF EXISTS "avis_insert" ON avis;
-- CREATE POLICY "avis_insert" ON avis FOR INSERT TO authenticated
--   WITH CHECK (auth.uid() = author_id);
-- ===========================================================================
