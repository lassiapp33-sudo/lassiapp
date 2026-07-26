-- ===========================================================================
-- LASSI — Commander un article "À la une" sans productId
-- ---------------------------------------------------------------------------
-- Permet au client de payer directement depuis un bloc À la une.
-- Sécurité : le prix vient du JSONB stocké en DB (pas du client).
-- ===========================================================================

CREATE OR REPLACE FUNCTION creer_commande_alaune(
  p_bloc_id    uuid,
  p_element_id text,
  p_qty        integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id    uuid := auth.uid();
  v_actif        boolean;
  v_expire_at    timestamptz;
  v_presta_id    uuid;
  v_elements     jsonb;
  v_element      jsonb;
  v_nom          text;
  v_prix         numeric;
  v_shop_id      uuid;
  v_shop_name    text;
  v_commission   numeric;
  v_total        numeric;
  v_total_client numeric;
  v_profile_name text;
  v_order_result jsonb;
  v_order_id     uuid;
BEGIN
  -- Validation qty
  IF p_qty < 1 OR p_qty > 99 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  -- Récupérer le bloc
  SELECT actif, expire_at, prestataire_id, elements
    INTO v_actif, v_expire_at, v_presta_id, v_elements
    FROM a_la_une
   WHERE id = p_bloc_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offre introuvable';
  END IF;

  IF NOT v_actif OR v_expire_at <= now() THEN
    RAISE EXCEPTION 'Offre expirée ou inactive';
  END IF;

  -- Trouver l'élément dans le JSONB
  SELECT el INTO v_element
    FROM jsonb_array_elements(v_elements) el
   WHERE el ->> 'id' = p_element_id
   LIMIT 1;

  IF v_element IS NULL THEN
    RAISE EXCEPTION 'Article introuvable dans l''offre';
  END IF;

  v_nom  := v_element ->> 'nom';
  v_prix := (v_element ->> 'prix')::numeric;

  IF v_prix IS NULL OR v_prix <= 0 THEN
    RAISE EXCEPTION 'Prix non défini pour cet article';
  END IF;

  -- Trouver la boutique du prestataire
  SELECT id, name INTO v_shop_id, v_shop_name
    FROM shops
   WHERE merchant_id = v_presta_id
   LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable';
  END IF;

  -- Calculs
  v_total        := v_prix * p_qty;
  v_commission   := CEIL(v_total * 0.01);
  v_total_client := v_total + v_commission;

  -- Nom du client
  SELECT name INTO v_profile_name FROM profiles WHERE id = v_client_id;

  -- Créer la commande via create_order_atomic (une seule transaction)
  SELECT create_order_atomic(
    v_shop_id,
    v_client_id,
    COALESCE(v_profile_name, 'Client'),
    v_total,
    0,
    NULL,
    'emporter',
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_name', v_nom,
        'qty', p_qty,
        'unit_price', v_prix
      )
    )
  ) INTO v_order_result;

  v_order_id := (v_order_result ->> 'id')::uuid;

  RETURN jsonb_build_object(
    'orderId',     v_order_id,
    'total',       v_total,
    'commission',  v_commission,
    'totalClient', v_total_client,
    'elementNom',  v_nom,
    'shopName',    v_shop_name,
    'shopId',      v_shop_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION creer_commande_alaune(uuid, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION creer_commande_alaune(uuid, text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
