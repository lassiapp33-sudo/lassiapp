-- Migration : ajoute le statut 'cancelled' à payout_queue
-- Utilisé par process-refund pour annuler le reversement prestataire
-- quand LASSI rembourse le client directement (full auto refund).

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'payout_queue'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%statut%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE payout_queue DROP CONSTRAINT ' || quote_ident(v_constraint_name);
  END IF;

  ALTER TABLE payout_queue ADD CONSTRAINT payout_queue_statut_check
    CHECK (statut IN ('queued','processing','paid','failed','disputed','cancelled'));
END;
$$;
