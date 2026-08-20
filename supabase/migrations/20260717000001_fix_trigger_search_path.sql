-- ===========================================================================
-- FIX : trigger functions manquaient SET search_path
-- ---------------------------------------------------------------------------
-- create_order_atomic a SET search_path = ''
-- En PostgreSQL, une trigger function sans son propre SET search_path
-- hérite du search_path de la fonction appelante = '' dans ce contexte.
-- Résultat : UPDATE shops / SELECT FROM shops → 42P01 "relation does not exist"
-- PostgREST mappe 42P01 en HTTP 404 → l'appel RPC semblait introuvable.
--
-- Fix : ajouter SET search_path = public sur les trois fonctions concernées.
-- ===========================================================================

-- ① fn_increment_shop_interactions (AFTER INSERT ON orders)
CREATE OR REPLACE FUNCTION public.fn_increment_shop_interactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shops
  SET interactions_count = interactions_count + 1
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$;

-- ② fn_increment_shop_orders (AFTER UPDATE ON orders)
CREATE OR REPLACE FUNCTION public.fn_increment_shop_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD IS NULL OR OLD.status <> 'done') THEN
    UPDATE public.shops
    SET
      orders_count = orders_count + 1,
      rating = compute_shop_rating(
        orders_count + 1,
        reviews_count,
        CASE WHEN reviews_count > 0 THEN rating ELSE 0 END
      )
    WHERE id = NEW.shop_id;
  END IF;

  IF NEW.status <> 'done' AND OLD.status = 'done' THEN
    UPDATE public.shops
    SET
      orders_count = GREATEST(0, orders_count - 1),
      rating = compute_shop_rating(
        GREATEST(0, orders_count - 1),
        reviews_count,
        CASE WHEN reviews_count > 0 THEN rating ELSE 0 END
      )
    WHERE id = NEW.shop_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ③ notify_merchant_new_order (AFTER INSERT ON orders)
CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM public.shops WHERE id = NEW.shop_id;
  IF v_merchant_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_merchant_id,
    'order',
    'Nouvelle commande',
    'Commande de ' || NEW.client_name || ' · ' || NEW.total || ' FCFA',
    jsonb_build_object('order_id', NEW.id, 'shop_id', NEW.shop_id)
  );
  RETURN NEW;
END;
$$;

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
