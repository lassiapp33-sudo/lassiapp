-- ===========================================================================
-- LASSİ — Fix récursion infinie RLS sur profiles
-- ---------------------------------------------------------------------------
-- Bug : les politiques profiles_admin_read / profiles_admin_update
-- (20250101030000_admin_and_disputes.sql) interrogent `profiles` depuis une
-- politique sur `profiles` -> Postgres renvoie 42P17 "infinite recursion
-- detected in policy for relation profiles" sur TOUTE lecture de profiles.
-- Conséquence : login impossible pour tous les utilisateurs ("Profil
-- introuvable"), avatars/maj profil cassés, etc.
--
-- Fix : fonction SECURITY DEFINER is_admin() qui contourne le RLS (même
-- mécanisme que get_auth_email_by_phone, déjà en prod et fonctionnel),
-- réutilisée dans toutes les policies/fonctions qui vérifiaient
-- "EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)".
--
-- Bonus : profiles_admin_update incluait pas `id = auth.uid()`, donc un
-- utilisateur ne pouvait pas modifier SON PROPRE profil (avatar, etc.) -> fixé.
-- ===========================================================================

-- ─── 1. Fonction helper SECURITY DEFINER (pas de récursion RLS) ────────────

CREATE OR REPLACE FUNCTION is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT profiles.is_admin FROM profiles WHERE id = p_uid), FALSE);
$$;

GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon, authenticated;


-- ─── 2. Politiques profiles : self + admin via is_admin() ──────────────────

DROP POLICY IF EXISTS profiles_admin_read ON profiles;
CREATE POLICY profiles_admin_read ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_admin(auth.uid())
  );

-- Un utilisateur peut modifier SON propre profil (avatar, etc.)
-- + un admin peut modifier tous les profils (suspendre, etc.)
DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR is_admin(auth.uid())
  );


-- ─── 3. Autres policies admin : remplacer le sous-select profiles par is_admin() ─

DROP POLICY IF EXISTS aal_admin_only ON admin_actions_log;
CREATE POLICY aal_admin_only ON admin_actions_log
  FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS disputes_select ON disputes;
CREATE POLICY disputes_select ON disputes FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR against_id  = auth.uid()
    OR is_admin(auth.uid())
  );

DROP POLICY IF EXISTS disputes_update ON disputes;
CREATE POLICY disputes_update ON disputes FOR UPDATE
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS dm_select ON dispute_messages;
CREATE POLICY dm_select ON dispute_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes d WHERE d.id = dispute_id AND (
        d.reporter_id = auth.uid()
        OR d.against_id = auth.uid()
        OR is_admin(auth.uid())
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
        OR is_admin(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS orders_admin_read ON orders;
CREATE POLICY orders_admin_read ON orders FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid())
    OR client_id = auth.uid()
    OR is_admin(auth.uid())
  );

DROP POLICY IF EXISTS shops_admin_update ON shops;
CREATE POLICY shops_admin_update ON shops FOR UPDATE
  USING (
    merchant_id = auth.uid()
    OR is_admin(auth.uid())
  );


-- ─── 4. Fonctions d'agrégation admin : remplacer le check inline par is_admin() ─

CREATE OR REPLACE FUNCTION get_gtv(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS NUMERIC LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(total), 0)
  FROM orders
  WHERE status IN ('done','ready','preparing')
    AND created_at BETWEEN p_from AND p_to
    AND is_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION get_gtv_daily(p_days INT DEFAULT 7)
RETURNS TABLE(day DATE, gtv NUMERIC, orders_count BIGINT) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COALESCE(SUM(total), 0)             AS gtv,
    COUNT(*)                            AS orders_count
  FROM orders
  WHERE status IN ('done','ready','preparing')
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND is_admin(auth.uid())
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION get_gtv_by_zone()
RETURNS TABLE(zone TEXT, orders_count BIGINT, gtv NUMERIC) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(NULLIF(TRIM(s.zone), ''), 'Zone inconnue') AS zone,
    COUNT(DISTINCT o.id)                                AS orders_count,
    COALESCE(SUM(o.total), 0)                          AS gtv
  FROM orders o
  JOIN shops s ON o.shop_id = s.id
  WHERE o.status IN ('done','ready','preparing')
    AND is_admin(auth.uid())
  GROUP BY s.zone
  ORDER BY gtv DESC;
$$;

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
  WHERE is_admin(auth.uid())
  GROUP BY s.id
  ORDER BY orders_count DESC, s.rating DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_open_disputes_count()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)
  FROM disputes
  WHERE status = 'open'
    AND is_admin(auth.uid());
$$;
