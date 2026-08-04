-- Fix contrainte CHECK sur notifications.type
-- La contrainte originale n'incluait pas 'ann' et 'livraison',
-- ajoutés plus tard pour les notifs "À la une" et livraison.
-- Ce fix élargit la contrainte pour inclure tous les types actifs.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order', 'payment', 'vip', 'message', 'debt', 'livraison', 'ann'));
