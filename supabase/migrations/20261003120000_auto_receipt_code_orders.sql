-- ============================================================
-- LASSI · Auto-génération receipt_code sur les orders
-- Migration 2026-10-03
-- ============================================================
-- confirm_order_from_payment (créé dans SQL Editor, non versionné)
-- ne positionne jamais receipt_code sur les orders réguliers.
-- Ce trigger le fait automatiquement dès que pay_method est renseigné.
-- ============================================================

-- ─── Fonction génératrice de code reçu ───────────────────────────────────────
-- Produit un code 8 caractères alphanumérique majuscule identique côté client.
CREATE OR REPLACE FUNCTION gen_order_receipt_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ─── Trigger : génère le reçu quand pay_method est confirmé ──────────────────
CREATE OR REPLACE FUNCTION trg_auto_receipt_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Déclenche si pay_method vient d'être positionné ET qu'il n'y a pas encore de code
  IF NEW.pay_method IS NOT NULL AND (OLD.pay_method IS NULL OR OLD.pay_method = '')
     AND (NEW.receipt_code IS NULL OR NEW.receipt_code = '') THEN

    NEW.receipt_code        := gen_order_receipt_code();
    NEW.receipt_status      := 'valide';
    NEW.receipt_valid_until := now() + interval '40 minutes';
    NEW.validated_at        := coalesce(NEW.validated_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_receipt_code ON orders;
CREATE TRIGGER trg_auto_receipt_code
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_auto_receipt_code();

-- ─── Backfill : orders existants payés sans receipt_code ─────────────────────
-- Génère un code pour toutes les commandes qui ont déjà un pay_method
-- mais n'ont pas encore de receipt_code (cas historique).
UPDATE orders
SET
  receipt_code        = gen_order_receipt_code(),
  receipt_status      = 'valide',
  receipt_valid_until = now() + interval '40 minutes',
  validated_at        = coalesce(validated_at, created_at)
WHERE
  pay_method IS NOT NULL
  AND pay_method <> ''
  AND (receipt_code IS NULL OR receipt_code = '');
