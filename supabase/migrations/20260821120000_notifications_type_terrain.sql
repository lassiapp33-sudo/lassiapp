-- Ajout de 'reservation_terrain' et 'commande' dans la contrainte CHECK de notifications.type
-- 'reservation_terrain' : paiement confirmé + accès validé terrain
-- 'commande' : déjà utilisé dans webhook-payment pour prestataire fitness (commande)

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'order',
    'payment',
    'vip',
    'message',
    'debt',
    'livraison',
    'ann',
    'commande',
    'reservation_terrain'
  ));
