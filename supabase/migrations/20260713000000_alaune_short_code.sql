-- ============================================
-- Code court pour liens À la une
-- Avant : https://lassi.sn/a-la-une/{uuid}?produit={id}
-- Après  : https://lassi.sn/b/{code}/{index}
-- ============================================

ALTER TABLE public.a_la_une
  ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alaune_code
  ON public.a_la_une (code) WHERE code IS NOT NULL;

-- Génère un code 6 chars sans caractères ambigus (pas 0/O, 1/l/I)
CREATE OR REPLACE FUNCTION public.gen_alaune_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR attempt IN 1..20 LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, (floor(random() * 31) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.a_la_une WHERE code = result) THEN
      RETURN result;
    END IF;
  END LOOP;
  -- Fallback 8 chars si collision (très improbable à cette échelle)
  result := '';
  FOR i IN 1..8 LOOP
    result := result || substr(chars, (floor(random() * 31) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger : assigne le code automatiquement à chaque INSERT
CREATE OR REPLACE FUNCTION public.set_alaune_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.gen_alaune_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alaune_code ON public.a_la_une;
CREATE TRIGGER trg_alaune_code
  BEFORE INSERT ON public.a_la_une
  FOR EACH ROW EXECUTE FUNCTION public.set_alaune_code();

-- Backfill des blocs existants
UPDATE public.a_la_une
SET code = public.gen_alaune_code()
WHERE code IS NULL;
