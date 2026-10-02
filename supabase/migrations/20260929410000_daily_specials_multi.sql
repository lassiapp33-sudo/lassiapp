-- Permet plusieurs plats du jour par boutique par date (supprime UNIQUE shop_id+date)
ALTER TABLE public.daily_specials DROP CONSTRAINT IF EXISTS daily_specials_shop_id_date_key;
