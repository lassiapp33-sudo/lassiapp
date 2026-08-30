-- Supprime définitivement les "!" dans les titres de notifications
-- Solution permanente : trigger BEFORE INSERT qui nettoie avant stockage

-- 1. Nettoyer les données existantes
UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '\s*!\s*$', '', 'g'))
WHERE title ~ '!\s*$';

-- 2. Mettre à jour la fonction notify_merchant_new_order pour s'assurer qu'elle est à jour
CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  IF NEW.status <> 'new' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' THEN RETURN NEW; END IF;

  SELECT merchant_id INTO v_merchant_id FROM public.shops WHERE id = NEW.shop_id;
  IF v_merchant_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_merchant_id, 'order', 'Nouvelle commande',
    'Commande de ' || NEW.client_name || ' · ' || NEW.total || ' FCFA',
    jsonb_build_object('order_id', NEW.id, 'shop_id', NEW.shop_id)
  );
  RETURN NEW;
END;
$$;

-- 3. Trigger BEFORE INSERT pour nettoyer les titres à la source
CREATE OR REPLACE FUNCTION public.clean_notification_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.title := TRIM(REGEXP_REPLACE(NEW.title, '\s*!\s*$', '', 'g'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clean_notif_title ON public.notifications;
CREATE TRIGGER trg_clean_notif_title
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.clean_notification_title();

NOTIFY pgrst, 'reload schema';
