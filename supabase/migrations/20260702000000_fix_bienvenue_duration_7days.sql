-- Récompense bienvenue : durée réduite à 7 jours (1 semaine).
-- Remplace la migration 20260626070000 qui avait fixé 49 jours.
--
-- 1. Recréer le trigger avec 7 jours.
-- 2. Recalculer les récompenses bienvenue actives existantes :
--    si created_at + 7 jours est déjà passé → expirer immédiatement,
--    sinon fixer la nouvelle date limite.

-- ── 1. Trigger ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_merchant_recompense_bienvenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    NOW() + INTERVAL '7 days',
    TRUE
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_recompense_bienvenue ON public.profiles;
CREATE TRIGGER trg_profiles_recompense_bienvenue
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_merchant_recompense_bienvenue();

-- ── 2. Recalculer les récompenses bienvenue actives existantes ────────────────
-- Si created_at + 7 jours < NOW() → déjà expirée, on la désactive.
-- Sinon on met la nouvelle date limite à created_at + 7 jours.

UPDATE public.recompenses_attribuees
SET
  valide_jusqu_a = created_at + INTERVAL '7 days',
  est_actif      = CASE
                     WHEN created_at + INTERVAL '7 days' > NOW() THEN TRUE
                     ELSE FALSE
                   END
WHERE type_classement = 'bienvenue'
  AND est_actif = TRUE;
