-- ===========================================================================
-- FIX : notify_merchant_new_order — ne notifier qu'après paiement confirmé
-- ---------------------------------------------------------------------------
-- Problème : le trigger trg_new_order se déclenche sur AFTER INSERT ON orders.
-- Pour les commandes OM/Wave, l'ordre est créé en statut 'pending' AVANT que le
-- client confirme le paiement. La notification arrivait donc chez le prestataire
-- immédiatement, avant tout paiement → risque de fraude (panier fantôme).
--
-- Fix :
--   1. La fonction vérifie que NEW.status = 'new' avant d'insérer la notification.
--      'new' = paiement confirmé (OM/Wave webhook → confirm_order_from_payment)
--            OU commande créée directement en 'new' (futur mode cash).
--   2. Le trigger écoute désormais INSERT OR UPDATE OF status pour capturer la
--      transition 'pending' → 'new' déclenchée par confirm_order_from_payment.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  -- Notifier uniquement quand la commande atteint 'new' (paiement reçu)
  IF NEW.status <> 'new' THEN RETURN NEW; END IF;
  -- Sur UPDATE : ne notifier que la PREMIÈRE transition vers 'new' (pas les updates suivants)
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' THEN RETURN NEW; END IF;

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

-- Recréer le trigger pour capturer INSERT (cash futur) ET UPDATE statut (OM/Wave)
DROP TRIGGER IF EXISTS trg_new_order ON public.orders;
CREATE TRIGGER trg_new_order
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_new_order();

NOTIFY pgrst, 'reload schema';
