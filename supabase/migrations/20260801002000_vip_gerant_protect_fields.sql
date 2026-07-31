-- Trigger : empêche le gérant VIP de modifier actif, categorie, gabarit, shop_id
-- via RLS (UPDATE autorisé sur sa propre ligne), mais ces colonnes sont réservées
-- à l'admin (service_role). La vérification porte sur auth.uid() : si la ligne
-- appartient au gérant courant ET qu'une de ces colonnes a changé → rejet.

CREATE OR REPLACE FUNCTION vip_proteger_champs_gerant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ignore si l'appelant est service_role (pas de jwt → auth.uid() est NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Colonnes protégées : ne peuvent être modifiées que via service_role
  IF NEW.actif      IS DISTINCT FROM OLD.actif      THEN
    RAISE EXCEPTION 'Le champ actif ne peut être modifié que par un administrateur.';
  END IF;
  IF NEW.categorie  IS DISTINCT FROM OLD.categorie  THEN
    RAISE EXCEPTION 'Le champ categorie ne peut être modifié que par un administrateur.';
  END IF;
  IF NEW.gabarit    IS DISTINCT FROM OLD.gabarit    THEN
    RAISE EXCEPTION 'Le champ gabarit ne peut être modifié que par un administrateur.';
  END IF;
  IF NEW.shop_id    IS DISTINCT FROM OLD.shop_id    THEN
    RAISE EXCEPTION 'Le champ shop_id ne peut être modifié que par un administrateur.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_proteger_champs ON vip_profils;

CREATE TRIGGER trg_vip_proteger_champs
  BEFORE UPDATE ON vip_profils
  FOR EACH ROW
  EXECUTE FUNCTION vip_proteger_champs_gerant();

-- Trigger : quand un profil VIP est supprimé, remettre shops.is_vip à false
CREATE OR REPLACE FUNCTION vip_reset_shop_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.shops SET is_vip = false WHERE id = OLD.shop_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_reset_shop_flag ON vip_profils;

CREATE TRIGGER trg_vip_reset_shop_flag
  AFTER DELETE ON vip_profils
  FOR EACH ROW
  EXECUTE FUNCTION vip_reset_shop_flag();
