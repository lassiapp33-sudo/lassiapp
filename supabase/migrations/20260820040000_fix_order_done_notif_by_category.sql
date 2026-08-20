-- Personnalise le corps de la notification "Terminée" selon la catégorie du shop.
-- Avant : "Bonne dégustation. Merci." hardcodé pour tous les types de commerce.
-- Après : texte adapté (sport, coiffure, boutique, alimentation/resto...).

CREATE OR REPLACE FUNCTION public.notify_client_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title    TEXT;
  v_body     TEXT;
  v_category TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'preparing' THEN
      v_title := 'En préparation 🔥';
      v_body  := 'Ta commande est en cours de préparation.';

    WHEN 'ready' THEN
      v_title := 'Commande prête 🔔';
      v_body  := 'Ta commande est prête, viens la récupérer.';

    WHEN 'done' THEN
      SELECT category INTO v_category FROM public.shops WHERE id = NEW.shop_id;
      v_title := 'Terminée ⭐';
      v_body  := CASE v_category
        WHEN 'food'      THEN 'Bonne dégustation. Merci.'
        WHEN 'tangana'   THEN 'Bonne dégustation. Merci.'
        WHEN 'bakery'    THEN 'Bonne dégustation. Merci.'
        WHEN 'fruiterie' THEN 'Bonne dégustation. Merci.'
        WHEN 'sport'     THEN 'Bonne séance. Profite de ta commande.'
        WHEN 'hair'      THEN 'Merci. À bientôt chez nous.'
        ELSE                  'Merci pour ta commande. À bientôt.'
      END;

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
