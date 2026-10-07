-- Fix: notify_merchant_new_order ne doit pas envoyer de notif sur les commandes
-- en statut 'pending' (paiement Wave/OM non encore confirmé).
-- Le prestataire recevra la notif uniquement quand la commande est confirmée (status='new').

CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  -- Ignorer les commandes en attente de paiement
  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = NEW.shop_id;
  IF v_merchant_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_merchant_id,
    'order',
    'Nouvelle commande',
    'Commande reçue · ' || COALESCE(NEW.total::text, '0') || ' FCFA',
    jsonb_build_object('order_id', NEW.id, 'shop_id', NEW.shop_id, 'type', 'new_order')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT d'une commande à cause d'une notif
  RETURN NEW;
END;
$$;
