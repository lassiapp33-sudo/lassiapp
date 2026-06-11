-- ============================================================
-- LASSI · Système de classements & récompenses · Migration 2026-06-11
-- ============================================================
-- Tables : prestataire_scores, classements, recompenses_attribuees,
--          carrousel_offre_quartier, client_scores
-- Déployer via : supabase db push
-- Le calcul des classements est TOUJOURS fait côté serveur (pg_cron),
-- l'app lit uniquement les snapshots figés dans `classements`.
-- ============================================================

-- ============================================================
-- TABLE : prestataire_scores
-- Accumule les points en continu (mis à jour à chaque commande/avis)
-- ============================================================
CREATE TABLE IF NOT EXISTS prestataire_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sous_categorie TEXT NOT NULL,
  quartier TEXT,

  -- Points de la période en cours
  points_semaine INTEGER DEFAULT 0,
  points_mois INTEGER DEFAULT 0,

  -- Détail (pour transparence)
  nb_commandes_semaine INTEGER DEFAULT 0,
  nb_commandes_mois INTEGER DEFAULT 0,
  note_moyenne NUMERIC(3,2) DEFAULT 0,
  nb_avis INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prestataire_id)
);

-- ============================================================
-- TABLE : classements (snapshot figé, lu par l'app)
-- ============================================================
CREATE TABLE IF NOT EXISTS classements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('sous_categorie', 'mondial', 'quartier', 'client')),
  periode TEXT NOT NULL,            -- ex: '2026-S23' (semaine) ou '2026-06' (mois)
  sous_categorie TEXT,              -- rempli si type='sous_categorie'
  quartier TEXT,                    -- rempli si type='quartier'

  prestataire_id UUID REFERENCES profiles(id),
  client_id UUID REFERENCES profiles(id),

  rang INTEGER NOT NULL,
  points INTEGER NOT NULL,
  nom_affiche TEXT,                 -- nom boutique ou client (dénormalisé pour lecture rapide)
  image_url TEXT,

  est_actif BOOLEAN DEFAULT true,   -- true = classement courant
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classements_lecture ON classements(type, periode, est_actif, rang);

-- ============================================================
-- TABLE : recompenses_attribuees
-- ============================================================
CREATE TABLE IF NOT EXISTS recompenses_attribuees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id UUID REFERENCES profiles(id),
  client_id UUID REFERENCES profiles(id),
  type_classement TEXT NOT NULL,    -- 'sous_categorie' | 'mondial' | 'client'
  periode TEXT NOT NULL,
  rang INTEGER NOT NULL,

  -- Récompenses (selon paliers)
  badge TEXT,
  certificat BOOLEAN DEFAULT false,
  priorite_recherche BOOLEAN DEFAULT false,
  credit_lassi INTEGER DEFAULT 0,
  carrousel_produits INTEGER DEFAULT 0, -- nb de produits autorisés
  top_vip BOOLEAN DEFAULT false,

  -- Validité
  valide_jusqu_a TIMESTAMPTZ,
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recompenses_presta ON recompenses_attribuees(prestataire_id, est_actif);

-- ============================================================
-- TABLE : carrousel_offre_quartier
-- Les produits que les top 5 mondiaux mettent en avant
-- ============================================================
CREATE TABLE IF NOT EXISTS carrousel_offre_quartier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  nom TEXT NOT NULL,
  prix INTEGER NOT NULL,           -- prix affiché (avec marge 1%)
  image_url TEXT NOT NULL,
  rang_prestataire INTEGER,        -- son rang mondial (1-5)
  ordre INTEGER DEFAULT 0,         -- ordre dans le carrousel
  periode TEXT NOT NULL,
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carrousel_actif ON carrousel_offre_quartier(est_actif, ordre);

-- ============================================================
-- TABLE : client_scores (pour le classement clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prestataire_prefere_id UUID REFERENCES profiles(id), -- chez qui il commande le +
  points_semaine INTEGER DEFAULT 0,
  points_mois INTEGER DEFAULT 0,
  nb_commandes_mois INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

-- ============================================================
-- RLS — tout le monde peut LIRE les classements (transparence)
-- ============================================================
ALTER TABLE classements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompenses_attribuees ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrousel_offre_quartier ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestataire_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classements_public_read" ON classements FOR SELECT USING (true);
CREATE POLICY "recompenses_public_read" ON recompenses_attribuees FOR SELECT USING (true);
CREATE POLICY "carrousel_public_read" ON carrousel_offre_quartier FOR SELECT USING (est_actif = true);
CREATE POLICY "scores_public_read" ON prestataire_scores FOR SELECT USING (true);
CREATE POLICY "client_scores_owner" ON client_scores FOR SELECT USING (true);

-- Le prestataire gère SES produits de carrousel (s'il y a droit)
CREATE POLICY "carrousel_presta_manage" ON carrousel_offre_quartier
  FOR ALL USING (auth.uid() = prestataire_id);
