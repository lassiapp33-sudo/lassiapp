-- ===========================================================================
-- LASSİ — Migration Admin, Mise en avant manuelle & Litiges
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ===========================================================================

-- ─── 1. FLAG ADMIN SUR LES PROFILS ──────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Pour t'accorder l'accès admin (remplace par ton numéro de téléphone) :
-- UPDATE profiles SET is_admin = TRUE WHERE phone = '77XXXXXXXX';


-- ─── 2. MISE EN AVANT MANUELLE (VIP + Recommandation) ───────────────────────

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS vip_manual            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vip_manual_until       TIMESTAMPTZ,          -- NULL = illimité
  ADD COLUMN IF NOT EXISTS featured_manual        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_manual_until  TIMESTAMPTZ,          -- NULL = illimité
  ADD COLUMN IF NOT EXISTS manual_note            TEXT;                  -- note interne admin


-- ─── 3. VUE COMBINÉE "is_vip effectif" (scoring + manuel) ──────────────────
-- Utilisée par le dashboard admin — l'app mobile peut continuer à lire is_vip directement.
-- Pour l'app mobile, l'admin met à jour is_vip manuellement via le dashboard.

DROP VIEW IF EXISTS shops_effective CASCADE;
CREATE VIEW shops_effective AS
  SELECT
    s.*,
    (
      s.is_vip = TRUE
      OR (
        s.vip_manual = TRUE
        AND (s.vip_manual_until IS NULL OR s.vip_manual_until > NOW())
      )
    ) AS is_effectively_vip,
    (
      s.featured_manual = TRUE
      AND (s.featured_manual_until IS NULL OR s.featured_manual_until > NOW())
    ) AS is_effectively_featured
  FROM shops s;


-- ─── 4. JOURNAL DES ACTIONS ADMIN ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_actions_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID        NOT NULL REFERENCES profiles(id),
  action           TEXT        NOT NULL,      -- ex: 'set_vip_manual', 'resolve_dispute'
  target_shop_id   UUID        REFERENCES shops(id),
  target_user_id   UUID        REFERENCES profiles(id),
  details          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins accèdent au journal
DROP POLICY IF EXISTS aal_admin_only ON admin_actions_log;
CREATE POLICY aal_admin_only ON admin_actions_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─── 5. LITIGES (DISPUTES) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID        NOT NULL REFERENCES profiles(id),
  reporter_role TEXT        NOT NULL CHECK (reporter_role IN ('client','merchant')),
  against_id    UUID        NOT NULL REFERENCES profiles(id),
  shop_id       UUID        REFERENCES shops(id),
  type          TEXT        NOT NULL CHECK (type IN ('order','debt')),
  order_id      UUID        REFERENCES orders(id),
  debt_id       UUID        REFERENCES debts(id),
  reason        TEXT        NOT NULL CHECK (reason IN (
                              'paid_not_received','wrong_product',
                              'payment_issue','debt_disagreement',
                              'no_response','other'
                            )),
  description   TEXT        NOT NULL,
  evidence_urls JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','in_review','resolved','rejected')),
  resolution    TEXT,
  resolved_by   UUID        REFERENCES profiles(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disputes_select ON disputes;
CREATE POLICY disputes_select ON disputes FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR against_id  = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS disputes_insert ON disputes;
CREATE POLICY disputes_insert ON disputes FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS disputes_update ON disputes;
CREATE POLICY disputes_update ON disputes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));


-- ─── 6. MESSAGES DE LITIGE ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dispute_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id     UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id      UUID        NOT NULL REFERENCES profiles(id),
  sender_role    TEXT        NOT NULL CHECK (sender_role IN ('client','merchant','admin')),
  message        TEXT        NOT NULL,
  attachment_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dm_select ON dispute_messages;
CREATE POLICY dm_select ON dispute_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes d WHERE d.id = dispute_id AND (
        d.reporter_id = auth.uid()
        OR d.against_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
      )
    )
  );

DROP POLICY IF EXISTS dm_insert ON dispute_messages;
CREATE POLICY dm_insert ON dispute_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM disputes d WHERE d.id = dispute_id AND (
        d.reporter_id = auth.uid()
        OR d.against_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
      )
    )
  );


-- ─── 7. BUCKET STORAGE POUR PREUVES ─────────────────────────────────────────
-- Crée un bucket "disputes" dans Supabase Storage UI (Private)
-- Policy : les parties du litige + admins peuvent lire ; tout user auth peut uploader

INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'disputes', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN CREATE POLICY "disputes_evidence_read"  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'disputes'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "disputes_evidence_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'disputes'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 8. POLITIQUES RLS ÉLARGIES POUR LES ADMINS ─────────────────────────────

-- Les admins peuvent lire TOUS les profils (pour la gestion utilisateurs)
DROP POLICY IF EXISTS profiles_admin_read ON profiles;
CREATE POLICY profiles_admin_read ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

-- Les admins peuvent modifier TOUS les profils (suspendre, etc.)
DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE));

-- Les admins peuvent lire TOUTES les commandes
DROP POLICY IF EXISTS orders_admin_read ON orders;
CREATE POLICY orders_admin_read ON orders FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid())
    OR client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Les admins peuvent modifier les shops (VIP, featured)
DROP POLICY IF EXISTS shops_admin_update ON shops;
CREATE POLICY shops_admin_update ON shops FOR UPDATE
  USING (
    merchant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─── 9. FONCTIONS SQL D'AGRÉGATION (appelées via supabase.rpc) ───────────────

-- GTV total sur une période
CREATE OR REPLACE FUNCTION get_gtv(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS NUMERIC LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(total), 0)
  FROM orders
  WHERE status IN ('done','ready','preparing')
    AND created_at BETWEEN p_from AND p_to
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE);
$$;

-- GTV groupé par jour sur les N derniers jours
CREATE OR REPLACE FUNCTION get_gtv_daily(p_days INT DEFAULT 7)
RETURNS TABLE(day DATE, gtv NUMERIC, orders_count BIGINT) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COALESCE(SUM(total), 0)             AS gtv,
    COUNT(*)                            AS orders_count
  FROM orders
  WHERE status IN ('done','ready','preparing')
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  GROUP BY 1
  ORDER BY 1;
$$;

-- GTV et commandes par zone géographique
CREATE OR REPLACE FUNCTION get_gtv_by_zone()
RETURNS TABLE(zone TEXT, orders_count BIGINT, gtv NUMERIC) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(NULLIF(TRIM(s.zone), ''), 'Zone inconnue') AS zone,
    COUNT(DISTINCT o.id)                                AS orders_count,
    COALESCE(SUM(o.total), 0)                          AS gtv
  FROM orders o
  JOIN shops s ON o.shop_id = s.id
  WHERE o.status IN ('done','ready','preparing')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  GROUP BY s.zone
  ORDER BY gtv DESC;
$$;

-- Top commerces par nombre de commandes (pour scoring VIP)
CREATE OR REPLACE FUNCTION get_top_shops_by_orders(p_limit INT DEFAULT 10)
RETURNS TABLE(
  shop_id UUID, shop_name TEXT, category TEXT, zone TEXT, logo_url TEXT,
  orders_count BIGINT, gtv NUMERIC, rating NUMERIC,
  is_vip BOOLEAN, vip_manual BOOLEAN, featured_manual BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id, s.name, s.category, s.zone, s.logo_url,
    COUNT(o.id)           AS orders_count,
    COALESCE(SUM(o.total), 0) AS gtv,
    s.rating,
    s.is_vip, s.vip_manual, s.featured_manual
  FROM shops s
  LEFT JOIN orders o ON o.shop_id = s.id AND o.status IN ('done','ready','preparing')
  WHERE EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  GROUP BY s.id
  ORDER BY orders_count DESC, s.rating DESC
  LIMIT p_limit;
$$;

-- Nombre de litiges ouverts (pour le badge sidebar)
CREATE OR REPLACE FUNCTION get_open_disputes_count()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)
  FROM disputes
  WHERE status = 'open'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE);
$$;
