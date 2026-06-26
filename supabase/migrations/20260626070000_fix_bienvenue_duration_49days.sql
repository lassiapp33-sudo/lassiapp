-- Corrige la durée de la récompense de bienvenue : 49 jours (7 semaines)
-- au lieu de NULL (Illimité).
--
-- 1. Met à jour le trigger handle_new_profile pour ajouter valide_jusqu_a.
-- 2. Corrige les lignes bienvenue existantes avec valide_jusqu_a IS NULL.

-- ── 1. Recréer la fonction trigger bienvenue avec durée 49 jours ─────────────

CREATE OR REPLACE FUNCTION public.handle_new_merchant_recompense_bienvenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne déclencher que pour les nouveaux marchands
  IF NEW.role <> 'merchant' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.recompenses_attribuees (
    prestataire_id,
    client_id,
    type_classement,
    periode,
    rang,
    badge,
    certificat,
    priorite_recherche,
    credit_lassi,
    carrousel_produits,
    top_vip,
    valide_jusqu_a,
    est_actif
  ) VALUES (
    NEW.id,
    NULL,
    'bienvenue',
    TO_CHAR(NOW(), 'YYYY-MM'),
    0,
    '🎁 Bienvenue sur LASSI',
    FALSE,
    FALSE,
    0,
    4,
    FALSE,
    NOW() + INTERVAL '49 days',   -- 7 semaines
    TRUE
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recrée le trigger sur profiles (remplace l'ancienne version si elle existe)
DROP TRIGGER IF EXISTS trg_profiles_recompense_bienvenue ON public.profiles;
CREATE TRIGGER trg_profiles_recompense_bienvenue
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_merchant_recompense_bienvenue();

-- ── 2. Corriger les récompenses bienvenue existantes sans durée ──────────────
-- Utilise created_at de la récompense comme base de calcul.

UPDATE public.recompenses_attribuees
SET    valide_jusqu_a = created_at + INTERVAL '49 days'
WHERE  type_classement = 'bienvenue'
  AND  valide_jusqu_a IS NULL
  AND  est_actif = TRUE;
