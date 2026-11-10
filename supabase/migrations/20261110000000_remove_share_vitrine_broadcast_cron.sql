-- Migration: suppression du cron job share-vitrine-broadcast
-- Ce job envoyait des notifications de partage de vitrine mar/ven/dim 13h
-- Créé hors migration (via SQL Editor), supprimé ici définitivement

SELECT cron.unschedule('share-vitrine-broadcast');
