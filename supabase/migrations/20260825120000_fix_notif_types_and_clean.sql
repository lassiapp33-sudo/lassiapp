-- Fix types notifications + nettoyage ! (v4)
-- 1. Anciennes notifs reversement avec type 'pay' → 'payment'
UPDATE public.notifications SET type = 'payment'
WHERE type = 'pay'
  AND (title ILIKE '%reversement%' OR title ILIKE '%revers%' OR body ILIKE '%revers%');

-- 2. Anciennes notifs abonnement/fitness avec type 'pay' → 'ann'
UPDATE public.notifications SET type = 'ann'
WHERE type = 'pay'
  AND (title ILIKE '%abonnement%' OR title ILIKE '%fitness%' OR title ILIKE '%expir%');

-- 3. Toutes les notifs 'pay' restantes → 'payment' (fallback)
UPDATE public.notifications SET type = 'payment'
WHERE type = 'pay';

-- 4. Nettoyage ! dans tous les titres
UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '\s*!\s*$', '', 'g'))
WHERE title ~ '!';

-- 5. Correctif ciblé "Nouvelle commande" toutes variantes
UPDATE public.notifications
SET title = 'Nouvelle commande'
WHERE title ILIKE '%nouvelle%commande%'
  AND title <> 'Nouvelle commande';

-- 6. Mettre à jour le cron pg_cron fitness pour utiliser type 'ann' au lieu de 'pay'
SELECT cron.unschedule('notify-fitness-expiry');

SELECT cron.schedule(
  'notify-fitness-expiry',
  '10 0 * * *',
  $$
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT client_id, 'ann',
      'Abonnement fitness bientôt expiré',
      'Ton abonnement « ' || nom_offre || ' » expire dans 3 jours. Pense à le renouveler !',
      jsonb_build_object('type', 'fitness_abonnement')
    FROM fitness_abonnements_clients
    WHERE statut = 'actif'
      AND date_expiration::date = (current_date + interval '3 days')::date;

    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT client_id, 'ann',
      'Abonnement fitness expiré',
      'Ton abonnement « ' || nom_offre || ' » a expiré aujourd''hui.',
      jsonb_build_object('type', 'fitness_abonnement')
    FROM fitness_abonnements_clients
    WHERE statut = 'expire'
      AND date_expiration::date = current_date;
  $$
);
