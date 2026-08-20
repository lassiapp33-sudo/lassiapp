-- ===========================================================================
-- FIX CRITIQUE : notifications prématurées + réservations fantômes gérant
-- Appliqué manuellement via SQL Editor le 2026-08-03
-- ===========================================================================
--
-- Bug 1 — notify_merchant_new_order (orders)
--   L'ancienne version du trigger s'exécutait sur tout INSERT dans orders,
--   y compris status='pending' (avant paiement Wave/OM).
--   Fix : ne notifier que quand status passe à 'new' (paiement confirmé).
--
-- Bug 2 — get_reservations_gerant (table_reservations)
--   La RPC retournait toutes les réservations, y compris non payées.
--   Fix : filtrer sur paiement_statut='paye' uniquement.
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

DROP TRIGGER IF EXISTS trg_new_order ON public.orders;
CREATE TRIGGER trg_new_order
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_new_order();

DROP FUNCTION IF EXISTS public.get_reservations_gerant(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.get_reservations_gerant(
  p_gerant_user_id UUID, p_statut TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, date_reservation DATE, heure_debut TIME, nb_personnes SMALLINT,
  motif TEXT, options_speciales TEXT[], statut TEXT, acompte_montant INTEGER,
  created_at TIMESTAMPTZ, space_nom TEXT, slot_label TEXT, client_nom TEXT, client_tel TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.date_reservation, r.heure_debut, r.nb_personnes, r.motif::TEXT,
    r.options_speciales, r.statut::TEXT, r.acompte_montant, r.created_at,
    s.nom, ts.label, pr.name, pr.phone
  FROM public.table_reservations r
  JOIN public.vip_profils vp ON vp.id = r.vip_profil_id
  LEFT JOIN public.restaurant_spaces s ON s.id = r.space_id
  LEFT JOIN public.restaurant_time_slots ts ON ts.id = r.time_slot_id
  LEFT JOIN public.profiles pr ON pr.id = r.client_id
  WHERE vp.gerant_user_id = p_gerant_user_id
    AND r.paiement_statut = 'paye'
    AND (p_statut IS NULL OR r.statut::TEXT = p_statut)
  ORDER BY r.date_reservation ASC, r.heure_debut ASC;
$$;

REVOKE ALL ON FUNCTION public.get_reservations_gerant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reservations_gerant TO authenticated;

NOTIFY pgrst, 'reload schema';
