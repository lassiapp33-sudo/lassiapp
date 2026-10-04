-- ============================================================
-- LASSI · Fix trigger receipt_code — create_order_atomic
-- Migration 2026-10-04
-- ============================================================
-- PROBLÈME : create_order_atomic positionne pay_method dès la création
-- (INSERT) donc OLD.pay_method n'est JAMAIS NULL lors du UPDATE de
-- confirm_order_from_payment → le trigger 20261003120000 ne tire jamais.
-- FIX : ajouter une deuxième condition — déclencher aussi quand le
-- statut passe de 'pending' → 'new'/'confirmed' avec pay_method déjà fixé.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_auto_receipt_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Cas 1 : pay_method vient d'être positionné (flux legacy sans create_order_atomic)
  IF NEW.pay_method IS NOT NULL AND (OLD.pay_method IS NULL OR OLD.pay_method = '')
     AND (NEW.receipt_code IS NULL OR NEW.receipt_code = '') THEN

    NEW.receipt_code        := gen_order_receipt_code();
    NEW.receipt_status      := 'valide';
    NEW.receipt_valid_until := now() + interval '40 minutes';
    NEW.validated_at        := coalesce(NEW.validated_at, now());

  -- Cas 2 : create_order_atomic a fixé pay_method dès la création ;
  --         confirm_order_from_payment change pending→new ou pending→confirmed.
  ELSIF OLD.status = 'pending'
    AND NEW.status IN ('new', 'confirmed')
    AND NEW.pay_method IS NOT NULL AND NEW.pay_method <> ''
    AND (NEW.receipt_code IS NULL OR NEW.receipt_code = '') THEN

    NEW.receipt_code        := gen_order_receipt_code();
    NEW.receipt_status      := 'valide';
    NEW.receipt_valid_until := now() + interval '40 minutes';
    NEW.validated_at        := coalesce(NEW.validated_at, now());

  END IF;
  RETURN NEW;
END;
$$;

-- Le trigger est déjà en place (migration précédente) — pas besoin de le recréer.
-- On recrée quand même pour être sûr du BEFORE UPDATE.
DROP TRIGGER IF EXISTS trg_auto_receipt_code ON orders;
CREATE TRIGGER trg_auto_receipt_code
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_auto_receipt_code();

-- Backfill des commandes confirmées sans receipt_code
UPDATE orders
SET
  receipt_code        = gen_order_receipt_code(),
  receipt_status      = 'valide',
  receipt_valid_until = now() + interval '40 minutes',
  validated_at        = coalesce(validated_at, created_at)
WHERE
  status IN ('new', 'confirmed', 'completed', 'delivered')
  AND pay_method IS NOT NULL
  AND pay_method <> ''
  AND (receipt_code IS NULL OR receipt_code = '');
