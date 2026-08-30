-- payments.prestataire_id → auth.users(id) sans ON DELETE SET NULL
-- bloque auth.admin.deleteUser() quand le prestataire a des paiements.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_prestataire_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_prestataire_id_fkey
  FOREIGN KEY (prestataire_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;
