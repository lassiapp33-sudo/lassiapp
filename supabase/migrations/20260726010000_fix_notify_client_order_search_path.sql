-- FIX : notify_client_order_status manquait SET search_path = public
-- Sans ça, quand appelée depuis confirm_order_from_payment (search_path=''),
-- "notifications" n'est pas trouvée → erreur 42P01.

CREATE OR REPLACE FUNCTION public.notify_client_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'preparing' THEN
      v_title := 'En préparation 👨‍🍳';
      v_body  := 'Ta commande est en cours de préparation.';
    WHEN 'ready' THEN
      v_title := 'Commande prête ! 🎉';
      v_body  := 'Ta commande est prête, viens la récupérer !';
    WHEN 'done' THEN
      v_title := 'Terminée ✅';
      v_body  := 'Bonne dégustation ! Merci.';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.client_id, 'order', v_title, v_body,
    jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
