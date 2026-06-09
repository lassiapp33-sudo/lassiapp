-- ─── Colonne is_featured sur shops (badge visibilité payante) ────────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── visibility_plans : source de vérité des offres et prix ──────────────────
-- Les prix sont chargés depuis cette table côté serveur.
-- Jamais depuis le client → impossible de manipuler le montant.

CREATE TABLE IF NOT EXISTS visibility_plans (
  id              TEXT    PRIMARY KEY,        -- '1m' | '3m' | '6m'
  label           TEXT    NOT NULL,           -- '1 mois'
  price           INTEGER NOT NULL,           -- en FCFA
  duration_months INTEGER NOT NULL,
  old_price       INTEGER,                    -- prix barré (NULL si pas de promo)
  per_label       TEXT    NOT NULL,           -- 'par mois' / '8 000 F/mois'
  popular         BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO visibility_plans (id, label, price, duration_months, old_price, per_label, popular) VALUES
  ('1m', '1 mois', 10000, 1, NULL,  'par mois',     FALSE),
  ('3m', '3 mois', 24000, 3, 30000, '8 000 F/mois', TRUE),
  ('6m', '6 mois', 42000, 6, 60000, '7 000 F/mois', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ─── visibility_subscriptions : historique des abonnements ────────────────────

CREATE TABLE IF NOT EXISTS visibility_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        NOT NULL REFERENCES shops(id)    ON DELETE CASCADE,
  merchant_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id        TEXT        NOT NULL REFERENCES visibility_plans(id),
  amount         INTEGER     NOT NULL,           -- montant réellement débité
  pay_method     TEXT        NOT NULL CHECK (pay_method IN ('wave', 'orange_money')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  transaction_id TEXT,                           -- ID retourné par Wave/OM
  started_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vissub_shop_status
  ON visibility_subscriptions (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_vissub_merchant
  ON visibility_subscriptions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_vissub_expires
  ON visibility_subscriptions (expires_at)
  WHERE status = 'active';

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE visibility_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_subscriptions  ENABLE ROW LEVEL SECURITY;

-- Plans : lecture par tout utilisateur authentifié (plans publics actifs)
DROP POLICY IF EXISTS "vis_plans_read" ON visibility_plans;
CREATE POLICY "vis_plans_read"
  ON visibility_plans FOR SELECT TO authenticated
  USING (active = TRUE);

-- Abonnements : chaque marchand lit uniquement ses propres lignes
DROP POLICY IF EXISTS "vis_subs_own_read" ON visibility_subscriptions;
CREATE POLICY "vis_subs_own_read"
  ON visibility_subscriptions FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- Les insertions et updates passent UNIQUEMENT par les Edge Functions
-- (service_role) → pas de policy INSERT/UPDATE pour authenticated

-- ─── Fonction cron : expirer les abonnements passés ──────────────────────────
-- À planifier via pg_cron : SELECT cron.schedule('expire-visibility', '0 1 * * *', $$...$$);

CREATE OR REPLACE FUNCTION expire_visibility_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE visibility_subscriptions
  SET    status = 'expired'
  WHERE  status = 'active'
    AND  expires_at < NOW();

  -- Retirer le badge featured des boutiques dont l'abonnement vient d'expirer
  UPDATE shops
  SET    is_featured = FALSE
  WHERE  id IN (
    SELECT shop_id
    FROM   visibility_subscriptions
    WHERE  status = 'expired'
      AND  expires_at >= NOW() - INTERVAL '1 day'
  );
END;
$$;
