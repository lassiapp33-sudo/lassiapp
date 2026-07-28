-- Admin : lecture de tous les abonnements visibilité (dashboard)
DROP POLICY IF EXISTS "vis_subs_admin_read" ON visibility_subscriptions;
CREATE POLICY "vis_subs_admin_read"
  ON visibility_subscriptions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Admin : lecture de tous les plans (y compris inactifs)
DROP POLICY IF EXISTS "vis_plans_admin_read" ON visibility_plans;
CREATE POLICY "vis_plans_admin_read"
  ON visibility_plans FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Admin : modification des plans (tarifs, label, active…)
DROP POLICY IF EXISTS "vis_plans_admin_update" ON visibility_plans;
CREATE POLICY "vis_plans_admin_update"
  ON visibility_plans FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
