-- ===========================================================================
-- LASSI — SECTION 2 : Audit RLS complet — corrections
-- ---------------------------------------------------------------------------
-- 5 failles corrigées par cette migration :
--
--  1. payment_intents : un client pouvait INSÉRER directement une ligne
--     (policy pi_client_insert) avec statut='confirmed'/'simulated', puis
--     appeler confirm_order_from_payment (EXECUTE ouvert à PUBLIC) →
--     commande validée SANS PAIEMENT RÉEL ("paiement gratuit").
--  2. orders / order_items : policies INSERT ouvertes à
--     "auth.uid() IS NOT NULL" → un user pouvait créer une commande au nom
--     d'un AUTRE client_id, avec n'importe quel statut/total, et ajouter des
--     articles à la commande de quelqu'un d'autre.
--  3. admin_actions_log : policy "FOR ALL USING (is_admin(...))" permettait
--     à un compte admin d'insérer/modifier/supprimer ses propres entrées de
--     log via supabase-js (anon/authenticated key) → audit trail falsifiable.
--  4. profiles : une policy "profiles_read_authenticated" (script ad-hoc
--     Lassi/supabase_fix_profiles_rls.sql / supabase_chat_profiles_fix.sql,
--     exécutée manuellement en SQL Editor, hors historique de migrations)
--     autorise "USING (auth.uid() IS NOT NULL)" → TOUT utilisateur
--     authentifié peut faire SELECT * FROM profiles et lire phone,
--     auth_email, is_admin, push_token de TOUS les comptes. Cette policy
--     permissive s'OR-combine avec profiles_admin_read et annule sa
--     restriction. + get_profile_by_id renvoyait le téléphone (PII) de
--     N'IMPORTE QUEL profil à N'IMPORTE QUEL utilisateur authentifié, sans
--     vérifier de relation (commande / conversation / réservation /
--     paiement en commun).
--  5. messages : policy UPDATE permettait à un participant de modifier
--     N'IMPORTE QUEL message de la conversation (y compris le contenu
--     écrit par l'autre participant) → restreint aux messages type='ticket'
--     (mise à jour du statut de paiement).
-- ===========================================================================


-- ===========================================================================
-- 1. PAYMENT_INTENTS — écriture exclusivement via Edge Functions
-- ===========================================================================

-- Un client ne doit JAMAIS pouvoir insérer une ligne dans payment_intents :
-- la création passe uniquement par la RPC create_payment_intent (appelée par
-- l'Edge Function create-payment avec la service_role key).
DROP POLICY IF EXISTS pi_client_insert ON payment_intents;

-- create_payment_intent : recalcule commission/total côté serveur mais ne
-- doit être appelable QUE depuis une Edge Function (service_role).
REVOKE EXECUTE ON FUNCTION create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT) TO service_role;

-- confirm_order_from_payment : valide la commande/réservation après paiement
-- confirmé. Ne doit être appelable QUE par le webhook Wave/OM (Edge Function
-- webhook-payment, service_role).
REVOKE EXECUTE ON FUNCTION confirm_order_from_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION confirm_order_from_payment(UUID) TO service_role;


-- ===========================================================================
-- 2. ORDERS / ORDER_ITEMS — un client ne peut créer une commande qu'en son
--    nom, à l'état initial 'new', et n'ajouter des articles qu'à SA commande
-- ===========================================================================

-- Avant : WITH CHECK (auth.uid() IS NOT NULL) → n'importe quel utilisateur
-- pouvait insérer une commande avec client_id = UUID d'un AUTRE utilisateur,
-- ou avec status='done'/'ready' directement (sans passer par le marchand).
DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (client_id IS NULL OR client_id = auth.uid())
    AND status = 'new'
  );

-- Avant : WITH CHECK (auth.uid() IS NOT NULL) → un utilisateur pouvait
-- ajouter/modifier des articles sur la commande de quelqu'un d'autre.
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND (o.client_id = auth.uid() OR o.client_id IS NULL)
        AND o.status = 'new'
    )
  );


-- ===========================================================================
-- 3. ADMIN_ACTIONS_LOG — logs immuables (lecture admin, écriture
--    service_role uniquement)
-- ===========================================================================

-- Avant : "FOR ALL USING (is_admin(auth.uid()))" → un admin pouvait
-- insérer/modifier/supprimer ses propres entrées de log via supabase-js
-- (anon/authenticated key). Toutes les Edge Functions admin-* écrivent déjà
-- via service_role (qui bypass RLS) : on retire donc tout accès écriture
-- pour anon/authenticated et on ne garde qu'une lecture admin.
DROP POLICY IF EXISTS aal_admin_only ON admin_actions_log;

CREATE POLICY admin_actions_log_select ON admin_actions_log FOR SELECT
  USING (is_admin(auth.uid()));

-- Aucune policy INSERT/UPDATE/DELETE pour anon/authenticated
-- → seul service_role (Edge Functions admin-*) peut écrire. Logs immuables.


-- ===========================================================================
-- 4. PROFILES
-- ===========================================================================

-- 4a. CRITIQUE : supprime la policy fourre-tout introduite par un script
-- ad-hoc (Lassi/supabase_fix_profiles_rls.sql et
-- Lassi/supabase_chat_profiles_fix.sql, exécutés hors historique de
-- migrations). "USING (auth.uid() IS NOT NULL)" permet à TOUT utilisateur
-- authentifié de lire la table profiles ENTIÈRE (phone, auth_email,
-- is_admin, push_token de tout le monde) — les policies Postgres étant
-- combinées en OR, cette policy annule la restriction de profiles_admin_read
-- ("id = auth.uid() OR is_admin(...)").
DROP POLICY IF EXISTS "profiles_read_authenticated" ON profiles;

-- 4b. get_profile_by_id : le téléphone n'est renvoyé qu'aux contacts
-- légitimes (commande / conversation / réservation / paiement en commun, ou
-- soi-même / admin). name + avatar_url restent publics.

CREATE OR REPLACE FUNCTION public.has_relationship_with(p_target UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_target = auth.uid()
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM orders o
      JOIN shops s ON s.id = o.shop_id
      WHERE (o.client_id = auth.uid() AND s.merchant_id = p_target)
         OR (o.client_id = p_target  AND s.merchant_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE (c.client_id = auth.uid() AND s.merchant_id = p_target)
         OR (c.client_id = p_target  AND s.merchant_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM reservations_terrain r
      WHERE (r.client_id = auth.uid() AND r.prestataire_id = p_target)
         OR (r.client_id = p_target  AND r.prestataire_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM payment_intents pi
      WHERE (pi.client_id = auth.uid() AND pi.prestataire_id = p_target)
         OR (pi.client_id = p_target  AND pi.prestataire_id = auth.uid())
    );
$$;

REVOKE ALL    ON FUNCTION public.has_relationship_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_relationship_with(UUID) TO authenticated;

-- DROP requis car CREATE OR REPLACE ne suffit pas si une version antérieure
-- de la fonction a un type de retour différent (cf. migrations précédentes).
DROP FUNCTION IF EXISTS public.get_profile_by_id(UUID);

CREATE FUNCTION public.get_profile_by_id(p_user_id UUID)
RETURNS TABLE(full_name TEXT, avatar_url TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    name,
    avatar_url,
    CASE WHEN has_relationship_with(p_user_id) THEN phone ELSE NULL END
  FROM profiles
  WHERE id = p_user_id;
$$;

REVOKE ALL    ON FUNCTION public.get_profile_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(UUID) TO authenticated;


-- ===========================================================================
-- 5. MESSAGES — un participant ne peut modifier que les messages type='ticket'
--    (mise à jour du statut de paiement), jamais le contenu écrit par l'autre
-- ===========================================================================

DROP POLICY IF EXISTS "msg_update" ON messages;
CREATE POLICY "msg_update" ON messages FOR UPDATE
  USING (
    type = 'ticket'
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid() OR s.merchant_id = auth.uid())
    )
  )
  WITH CHECK (
    type = 'ticket'
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid() OR s.merchant_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
