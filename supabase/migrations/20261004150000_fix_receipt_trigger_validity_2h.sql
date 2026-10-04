-- ============================================================
-- LASSI · Fix trigger reçu + validité 2h
-- Migration 2026-10-04
-- ============================================================
-- PROBLÈME : le trigger Cas 2 vérifie NEW.status IN ('new','confirmed')
-- mais confirm_order_from_payment peut transitionner vers d'autres
-- statuts (ex. 'preparing', 'done') → trigger ne tire jamais →
-- receipt_valid_until = NULL → client voit "Expiré" immédiatement.
-- FIX : Condition catch-all — déclenche dès que pay_method est défini
-- ET statut ≠ 'pending'/'refused', indépendamment de la valeur exacte.
-- AUSSI : validité 40 min → 120 min (2h).
-- ============================================================

CREATE OR REPLACE FUNCTION trg_auto_receipt_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Déclenche si : pay_method défini + statut confirmé (pas pending/refused) + pas de code encore
  IF NEW.pay_method IS NOT NULL AND NEW.pay_method <> ''
     AND NEW.status NOT IN ('pending', 'refused')
     AND (NEW.receipt_code IS NULL OR NEW.receipt_code = '') THEN

    NEW.receipt_code        := gen_order_receipt_code();
    NEW.receipt_status      := 'valide';
    NEW.receipt_valid_until := now() + interval '120 minutes';
    NEW.validated_at        := coalesce(NEW.validated_at, now());

  END IF;
  RETURN NEW;
END;
$$;

-- Recréer le trigger (BEFORE UPDATE)
DROP TRIGGER IF EXISTS trg_auto_receipt_code ON orders;
CREATE TRIGGER trg_auto_receipt_code
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_auto_receipt_code();

-- Backfill : prolonger les reçus existants 'valide' dont receipt_valid_until est dans le passé
-- (ceux générés par les migrations précédentes avec l'heure du backfill)
UPDATE orders
SET receipt_valid_until = now() + interval '120 minutes'
WHERE receipt_status = 'valide'
  AND (receipt_valid_until IS NULL OR receipt_valid_until < now());
