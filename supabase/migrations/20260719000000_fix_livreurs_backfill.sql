-- ============================================================
-- Fix : livreurs dont la ligne dans public.livreurs est absente
-- Cas : compte créé avant le fix Edge Function, ou insertion
-- partielle où profiles.role = 'livreur' existe mais livreurs n'a
-- pas de ligne correspondante → accepter_livraison échoue avec
-- NON_AUTORISE même si l'auth est correcte.
-- ============================================================

-- Backfill : insérer les lignes manquantes en extrayant le numéro
-- depuis l'email interne (livreur.7761234567@lassi.internal)
INSERT INTO public.livreurs (id, nom_complet, telephone, actif, cree_par)
SELECT
  p.id,
  COALESCE(NULLIF(TRIM(p.name), ''), 'Livreur'),
  REPLACE(REPLACE(u.email, 'livreur.', ''), '@lassi.internal', ''),
  true,
  NULL
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.livreurs l ON l.id = p.id
WHERE p.role = 'livreur'
  AND l.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- S'assurer que tous les livreurs actifs ont bien role='livreur' dans profiles
-- (cas où le trigger a créé le profil avec role='client' par défaut)
UPDATE public.profiles p
SET role = 'livreur'
FROM public.livreurs l
WHERE l.id = p.id
  AND l.actif = true
  AND p.role <> 'livreur';
