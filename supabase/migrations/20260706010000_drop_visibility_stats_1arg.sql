-- Supprime la version 1-arg de get_shop_visibility_stats.
-- La version 2-arg (p_shop_id, p_offer_type DEFAULT 'quartier') la remplace
-- et couvre tous les cas. La coexistence des deux signatures causait une
-- ambiguïté PostgREST PGRST203 lors des appels avec un seul paramètre.

DROP FUNCTION IF EXISTS get_shop_visibility_stats(uuid);
