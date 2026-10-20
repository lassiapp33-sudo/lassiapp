-- Migration : ajouter push background dans les triggers de notification commandes
-- notify_client_order_status : push client quand statut change (preparing/ready/done)
-- notify_merchant_new_order  : push marchand quand nouvelle commande (status != pending)

CREATE OR REPLACE FUNCTION notify_client_order_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_title    TEXT;
  v_body     TEXT;
  v_category TEXT;
  v_srk      TEXT;
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

  -- Push background (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_srk
    FROM vault.decrypted_secrets WHERE name = 'lassi_service_role_key' LIMIT 1;
    IF v_srk IS NOT NULL THEN
      PERFORM net.http_post(
        url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_srk
        ),
        body := jsonb_build_object(
          'targetUserId', NEW.client_id,
          'type',         'order_ready',
          'title',        v_title,
          'body',         v_body,
          'data',         jsonb_build_object('order_id', NEW.id, 'type', 'order_status'),
          'channelId',    'commandes-v2'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_merchant_new_order()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_merchant_id UUID;
  v_srk         TEXT;
BEGIN
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

  -- Push background (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_srk
    FROM vault.decrypted_secrets WHERE name = 'lassi_service_role_key' LIMIT 1;
    IF v_srk IS NOT NULL THEN
      PERFORM net.http_post(
        url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_srk
        ),
        body := jsonb_build_object(
          'targetUserId', v_merchant_id,
          'type',         'new_order',
          'title',        'Nouvelle commande 🛒',
          'body',         'Commande reçue · ' || COALESCE(NEW.total::text, '0') || ' FCFA',
          'data',         jsonb_build_object('order_id', NEW.id, 'shop_id', NEW.shop_id, 'type', 'new_order'),
          'channelId',    'commandes-v3'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
