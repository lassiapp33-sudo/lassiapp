-- Active la réplication Realtime sur shops pour que les DELETE
-- soient diffusés au client app et invalident le cache en mémoire.
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
