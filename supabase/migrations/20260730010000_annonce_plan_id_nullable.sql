-- Annonce sponsorisée : le planId est dynamique ("ad_Ncr") et n'existe pas
-- dans visibility_plans. La colonne plan_id doit être nullable pour ce cas.
-- La FK reste active pour les valeurs non-nulles (quartier, boost).

ALTER TABLE public.visibility_subscriptions
  ALTER COLUMN plan_id DROP NOT NULL;

-- Sécurité supplémentaire : s'assurer que le CHECK sur offer_type inclut 'annonce'.
-- Le DO block trouve le nom réel du constraint (en cas de nom auto-généré différent).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.visibility_subscriptions'::regclass
      AND  contype  = 'c'
      AND  pg_get_constraintdef(oid) LIKE '%offer_type%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.visibility_subscriptions DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.visibility_subscriptions
  ADD CONSTRAINT visibility_subscriptions_offer_type_check
    CHECK (offer_type IN ('quartier', 'recherche', 'carte', 'annonce'));
