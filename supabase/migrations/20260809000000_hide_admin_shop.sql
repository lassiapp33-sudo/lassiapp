-- Masque la boutique du compte admin dans les listings client.
-- Le compte admin (is_admin=true dans profiles) ne doit pas apparaître
-- dans la liste des commerçants visible par les clients.

-- ─── 1. Colonne sur shops ────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_admin_account BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Peupler les boutiques existantes ────────────────────────────────────

UPDATE public.shops s
SET is_admin_account = TRUE
FROM public.profiles p
WHERE s.merchant_id = p.id
  AND p.is_admin = TRUE;

-- ─── 3. Trigger : synchro automatique quand profiles.is_admin change ────────

CREATE OR REPLACE FUNCTION public.sync_shop_admin_account()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shops
  SET is_admin_account = NEW.is_admin
  WHERE merchant_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shop_admin_account ON public.profiles;
CREATE TRIGGER trg_sync_shop_admin_account
  AFTER UPDATE OF is_admin ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_admin IS DISTINCT FROM NEW.is_admin)
  EXECUTE FUNCTION public.sync_shop_admin_account();
