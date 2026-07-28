-- ─── 1. Colonne plan_type sur visibility_plans ────────────────────────────────
ALTER TABLE visibility_plans
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'quartier';

-- ─── 2. Forfaits Booster recherche (dans visibility_plans, type=recherche) ────
INSERT INTO visibility_plans
  (id, label, price, duration_months, duration_days, old_price, per_label, popular, active, plan_type)
VALUES
  ('boost_1m', '1 mois',  500,  1, 30,  NULL, '500 F/mois', false, true, 'recherche'),
  ('boost_3m', '3 mois',  1000, 3, 90,  1500, '333 F/mois', true,  true, 'recherche'),
  ('boost_6m', '6 mois',  2500, 6, 180, 3000, '417 F/mois', false, true, 'recherche')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Table ad_packs (Annonces sponsorisées) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_packs (
  id             TEXT    PRIMARY KEY,
  label          TEXT    NOT NULL,
  tagline        TEXT    NOT NULL,
  budget_credits INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  est_min        INTEGER NOT NULL,
  est_max        INTEGER NOT NULL,
  popular        BOOLEAN NOT NULL DEFAULT FALSE,
  active         BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO ad_packs
  (id, label, tagline, budget_credits, duration_hours, est_min, est_max, popular)
VALUES
  ('decouverte', 'Découverte', 'Idéal pour tester',            2000,  12, 1500,  5000,  false),
  ('populaire',  'Populaire',  'Meilleur rapport portée/prix', 5000,  24, 5000,  18000, true),
  ('boost_max',  'Boost Max',  'Couverture maximale',          12000, 48, 9000,  30000, false)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. RLS ad_packs ─────────────────────────────────────────────────────────
ALTER TABLE ad_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_packs_read"         ON ad_packs;
DROP POLICY IF EXISTS "ad_packs_admin_update" ON ad_packs;

CREATE POLICY "ad_packs_read" ON ad_packs FOR SELECT TO authenticated
  USING (active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "ad_packs_admin_update" ON ad_packs FOR UPDATE TO authenticated
  USING    (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
