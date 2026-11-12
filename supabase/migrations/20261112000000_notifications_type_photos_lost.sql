-- Ajoute le type 'photos_lost' à la contrainte notifications_type_check.
-- Utilisé par l'Edge Function notify-photos-lost (campagne photos produits perdues).
-- La notif s'affiche en BANNIÈRE côté client avec un bouton "Ouvrir le catalogue"
-- qui redirige le marchand vers sa boutique (écran 'store').

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'order'::text,
    'payment'::text,
    'vip'::text,
    'message'::text,
    'debt'::text,
    'livraison'::text,
    'ann'::text,
    'commande'::text,
    'reservation_terrain'::text,
    'setup_shop'::text,
    'share_vitrine'::text,
    'photos_lost'::text
  ])
);
