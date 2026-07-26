-- RPC SECURITY DEFINER : annulation commande côté client
-- Les clients n'ont pas de politique UPDATE sur orders → cette fonction bypasse le RLS
-- en vérifiant elle-même que client_id = auth.uid() et que status = 'new'.

CREATE OR REPLACE FUNCTION public.annuler_commande_client(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET status = 'refused'
  WHERE id = p_order_id
    AND client_id = auth.uid()
    AND status = 'new';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable, déjà traitée ou non autorisée';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.annuler_commande_client(uuid) TO authenticated;
