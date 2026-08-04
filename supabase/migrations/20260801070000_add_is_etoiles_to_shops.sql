-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : colonne is_etoiles sur shops + protection cron + triggers
-- Résout : update_vip_rankings() écrasait is_vip des 5 Étoiles chaque lundi
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ajout de la colonne is_etoiles
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_etoiles BOOLEAN NOT NULL DEFAULT false;

-- 2. Synchronisation initiale : marquer les shops qui ont déjà un profil VIP
UPDATE public.shops
SET is_etoiles = true
WHERE id IN (SELECT shop_id FROM public.vip_profils WHERE actif = true);

-- 3. Corriger update_vip_rankings() pour ne pas toucher les 5 Étoiles
CREATE OR REPLACE FUNCTION update_vip_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset VIP uniquement pour les shops qui ne sont PAS 5 Étoiles
  UPDATE public.shops
  SET is_vip = false, vip_rank = null
  WHERE is_etoiles = false;

  -- Top 3 par catégorie (7 derniers jours, commandes LASSI finalisées)
  WITH weekly_counts AS (
    SELECT
      s.id        AS shop_id,
      s.category,
      COUNT(o.id) AS order_count
    FROM public.shops s
    JOIN public.orders o ON o.shop_id = s.id
      AND o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= NOW() - INTERVAL '7 days'
    WHERE s.is_etoiles = false
    GROUP BY s.id, s.category
  ),
  ranked AS (
    SELECT
      shop_id,
      ROW_NUMBER() OVER (PARTITION BY category ORDER BY order_count DESC) AS rnk
    FROM weekly_counts
  )
  UPDATE public.shops
  SET is_vip = true, vip_rank = ranked.rnk
  FROM ranked
  WHERE public.shops.id = ranked.shop_id
    AND ranked.rnk <= 3;
END;
$$;

-- 4. Trigger : quand un profil VIP est inséré → is_etoiles = true sur le shop
CREATE OR REPLACE FUNCTION vip_set_etoiles_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.shops
  SET is_etoiles = true, is_vip = true
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_set_etoiles_insert ON public.vip_profils;
CREATE TRIGGER trg_vip_set_etoiles_insert
  AFTER INSERT ON public.vip_profils
  FOR EACH ROW
  EXECUTE FUNCTION vip_set_etoiles_on_insert();

-- 5. Trigger : quand un profil VIP est supprimé → is_etoiles = false (is_vip déjà géré)
CREATE OR REPLACE FUNCTION vip_reset_etoiles_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.shops
  SET is_etoiles = false, is_vip = false
  WHERE id = OLD.shop_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_reset_etoiles_delete ON public.vip_profils;
CREATE TRIGGER trg_vip_reset_etoiles_delete
  AFTER DELETE ON public.vip_profils
  FOR EACH ROW
  EXECUTE FUNCTION vip_reset_etoiles_on_delete();

-- 6. Politique RLS lecture publique sur is_etoiles (colonne déjà dans shops qui est publique)
-- rien à faire : shops a déjà USING (true) pour SELECT
