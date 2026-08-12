-- ============================================================
-- Fiche Guidée : suggestions prédéfinies éditables par l'admin
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suggestions_fiche (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id    TEXT        NOT NULL,
  sous_categorie_id TEXT,
  section         TEXT        NOT NULL CHECK (section IN (
                    'type_contenu', 'sous_categorie_produit', 'nom_produit', 'prix'
                  )),
  valeur          TEXT        NOT NULL,
  ordre           INT         NOT NULL DEFAULT 0,
  actif           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_lookup
  ON public.suggestions_fiche (categorie_id, section, actif, ordre);

-- RLS
ALTER TABLE public.suggestions_fiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture suggestions actives" ON public.suggestions_fiche
  FOR SELECT USING (actif = true);

CREATE POLICY "admin gere suggestions" ON public.suggestions_fiche
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ──────────────────────────────────────────────────────────────
-- Données de départ — enrichissables depuis le dashboard admin
-- Les categorie_id correspondent aux CatId de l'application.
-- ──────────────────────────────────────────────────────────────

-- food (Restos & Boissons)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('food', 'type_contenu',          'Menu',            1),
  ('food', 'type_contenu',          'Carte',           2),
  ('food', 'sous_categorie_produit','Repas',           1),
  ('food', 'sous_categorie_produit','Dessert',         2),
  ('food', 'sous_categorie_produit','Boisson',         3),
  ('food', 'sous_categorie_produit','Entrée',          4),
  ('food', 'nom_produit',           'Burger',          1),
  ('food', 'nom_produit',           'Chawarma',        2),
  ('food', 'nom_produit',           'Thiéboudienne',   3),
  ('food', 'nom_produit',           'Yassa poulet',    4),
  ('food', 'nom_produit',           'Pizza',           5),
  ('food', 'nom_produit',           'Poulet braisé',   6),
  ('food', 'nom_produit',           'Jus de bissap',   7),
  ('food', 'nom_produit',           'Jus de bouye',    8),
  ('food', 'prix',                  '1000',            1),
  ('food', 'prix',                  '1500',            2),
  ('food', 'prix',                  '2000',            3),
  ('food', 'prix',                  '2500',            4),
  ('food', 'prix',                  '3000',            5),
  ('food', 'prix',                  '5000',            6)
ON CONFLICT DO NOTHING;

-- hair (Coiffeurs & Salons)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('hair', 'type_contenu',          'Catalogue',        1),
  ('hair', 'type_contenu',          'Tarifs',           2),
  ('hair', 'sous_categorie_produit','Type de coiffure', 1),
  ('hair', 'sous_categorie_produit','Soin',             2),
  ('hair', 'sous_categorie_produit','Coloration',       3),
  ('hair', 'sous_categorie_produit','Barbe',            4),
  ('hair', 'nom_produit',           'Dégradé américain',1),
  ('hair', 'nom_produit',           'Dégradé classique',2),
  ('hair', 'nom_produit',           'Nattes',           3),
  ('hair', 'nom_produit',           'Tresses',          4),
  ('hair', 'nom_produit',           'Vanilles',         5),
  ('hair', 'nom_produit',           'Coupe + Barbe',    6),
  ('hair', 'nom_produit',           'Tissage',          7),
  ('hair', 'prix',                  '1000',             1),
  ('hair', 'prix',                  '2000',             2),
  ('hair', 'prix',                  '3500',             3),
  ('hair', 'prix',                  '5000',             4),
  ('hair', 'prix',                  '8000',             5)
ON CONFLICT DO NOTHING;

-- tangana (Tangana / Ndéki / Soupe)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('tangana', 'type_contenu',          'Menu',           1),
  ('tangana', 'type_contenu',          'Carte du jour',  2),
  ('tangana', 'sous_categorie_produit','Petit-déjeuner', 1),
  ('tangana', 'sous_categorie_produit','Repas du midi',  2),
  ('tangana', 'sous_categorie_produit','Boisson',        3),
  ('tangana', 'sous_categorie_produit','Snack',          4),
  ('tangana', 'nom_produit',           'Café Touba + Pain',1),
  ('tangana', 'nom_produit',           'Pain Thon Mayo', 2),
  ('tangana', 'nom_produit',           'Soupe kandia',   3),
  ('tangana', 'nom_produit',           'Thiébou yapp',   4),
  ('tangana', 'nom_produit',           'Lakh',           5),
  ('tangana', 'nom_produit',           'Beignets',       6),
  ('tangana', 'prix',                  '200',            1),
  ('tangana', 'prix',                  '300',            2),
  ('tangana', 'prix',                  '500',            3),
  ('tangana', 'prix',                  '1000',           4),
  ('tangana', 'prix',                  '1500',           5)
ON CONFLICT DO NOTHING;

-- bakery (Boulangeries)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('bakery', 'type_contenu',          'Carte',            1),
  ('bakery', 'type_contenu',          'Menu',             2),
  ('bakery', 'sous_categorie_produit','Pains',            1),
  ('bakery', 'sous_categorie_produit','Sandwichs',        2),
  ('bakery', 'sous_categorie_produit','Pâtisseries',      3),
  ('bakery', 'nom_produit',           'Baguette',         1),
  ('bakery', 'nom_produit',           'Pain de mie',      2),
  ('bakery', 'nom_produit',           'Sandwich Thon',    3),
  ('bakery', 'nom_produit',           'Gâteau au chocolat',4),
  ('bakery', 'nom_produit',           'Croissant',        5),
  ('bakery', 'prix',                  '150',              1),
  ('bakery', 'prix',                  '300',              2),
  ('bakery', 'prix',                  '500',              3),
  ('bakery', 'prix',                  '1000',             4),
  ('bakery', 'prix',                  '2500',             5)
ON CONFLICT DO NOTHING;

-- stores (Commerçants)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('stores', 'type_contenu',          'Catalogue',       1),
  ('stores', 'type_contenu',          'Liste produits',  2),
  ('stores', 'sous_categorie_produit','Alimentation',    1),
  ('stores', 'sous_categorie_produit','Boissons',        2),
  ('stores', 'sous_categorie_produit','Produits laitiers',3),
  ('stores', 'sous_categorie_produit','Quincaillerie',   4),
  ('stores', 'nom_produit',           'Riz parfumé 5kg', 1),
  ('stores', 'nom_produit',           'Sucre 1kg',       2),
  ('stores', 'nom_produit',           'Huile 1L',        3),
  ('stores', 'nom_produit',           'Lait frais',      4),
  ('stores', 'nom_produit',           'Eau minérale',    5),
  ('stores', 'prix',                  '500',             1),
  ('stores', 'prix',                  '1000',            2),
  ('stores', 'prix',                  '1500',            3),
  ('stores', 'prix',                  '2000',            4),
  ('stores', 'prix',                  '5000',            5)
ON CONFLICT DO NOTHING;

-- fruiterie (Fruiterie)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('fruiterie', 'type_contenu',          'Catalogue',          1),
  ('fruiterie', 'type_contenu',          'Tarifs',             2),
  ('fruiterie', 'sous_categorie_produit','Fruits frais',       1),
  ('fruiterie', 'sous_categorie_produit','Fruits marinés',     2),
  ('fruiterie', 'sous_categorie_produit','Jus de fruits',      3),
  ('fruiterie', 'nom_produit',           'Mangues',            1),
  ('fruiterie', 'nom_produit',           'Bananes',            2),
  ('fruiterie', 'nom_produit',           'Papayes',            3),
  ('fruiterie', 'nom_produit',           'Ananas',             4),
  ('fruiterie', 'nom_produit',           'Fruits marinés piment',5),
  ('fruiterie', 'prix',                  '200',                1),
  ('fruiterie', 'prix',                  '500',                2),
  ('fruiterie', 'prix',                  '1000',               3),
  ('fruiterie', 'prix',                  '1500',               4),
  ('fruiterie', 'prix',                  '2000',               5)
ON CONFLICT DO NOTHING;

-- sport (Sport / Fitness / Terrains)
INSERT INTO public.suggestions_fiche (categorie_id, section, valeur, ordre) VALUES
  ('sport', 'type_contenu',          'Catalogue',        1),
  ('sport', 'type_contenu',          'Tarifs séance',    2),
  ('sport', 'sous_categorie_produit','Séances',          1),
  ('sport', 'sous_categorie_produit','Formules',         2),
  ('sport', 'sous_categorie_produit','Accessoires',      3),
  ('sport', 'nom_produit',           'Séance découverte',1),
  ('sport', 'nom_produit',           'Cours collectif 1h',2),
  ('sport', 'nom_produit',           'Coaching individuel',3),
  ('sport', 'nom_produit',           'Protège-tibias',   4),
  ('sport', 'nom_produit',           'Gants de boxe',    5),
  ('sport', 'prix',                  '1000',             1),
  ('sport', 'prix',                  '2000',             2),
  ('sport', 'prix',                  '3000',             3),
  ('sport', 'prix',                  '5000',             4),
  ('sport', 'prix',                  '10000',            5)
ON CONFLICT DO NOTHING;
