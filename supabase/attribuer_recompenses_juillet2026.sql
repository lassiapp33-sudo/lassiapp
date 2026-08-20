-- ===========================================================================
-- ATTRIBUTION RÉTROACTIVE — Classement Mondial Juillet 2026
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor.
-- Idempotent : ne fait rien si les récompenses existent déjà.
-- ===========================================================================

DO $$
DECLARE
  v_periode        TEXT := '2026-07';
  v_expiry         TIMESTAMPTZ := '2026-08-31 23:59:59 UTC';
  v_existing_count INTEGER;
  v_winner         RECORD;
  v_shop_id        UUID;
  v_credit         INTEGER;
BEGIN

  -- ── Garde-fou idempotence ─────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_existing_count
  FROM recompenses_attribuees
  WHERE type_classement = 'mondial' AND periode = v_periode;

  IF v_existing_count > 0 THEN
    RAISE NOTICE 'Récompenses % déjà attribuées (% entrées). Rien à faire.', v_periode, v_existing_count;
    RETURN;
  END IF;

  -- ── Parcourir le top 40 du classement mondial juillet ─────────────────────
  FOR v_winner IN
    SELECT rang, points, prestataire_id
    FROM   classements
    WHERE  type       = 'mondial'
      AND  periode    = v_periode
      AND  est_actif  = true
      AND  points     > 0
    ORDER BY rang ASC
    LIMIT 40
  LOOP

    DECLARE
      v_badge             TEXT;
      v_certificat        BOOLEAN;
      v_priorite          BOOLEAN;
      v_credit_lassi      INTEGER;
      v_carrousel         INTEGER;
      v_valide_jusqu_a    TIMESTAMPTZ;
    BEGIN

      -- ── Palier selon le rang ────────────────────────────────────────────
      IF    v_winner.rang = 1  THEN
        v_badge='Champion National'; v_certificat=true; v_priorite=true; v_credit_lassi=8000; v_carrousel=5; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang = 2  THEN
        v_badge='Vice-Champion';     v_certificat=true; v_priorite=true; v_credit_lassi=5000; v_carrousel=4; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang = 3  THEN
        v_badge='3e National';       v_certificat=true; v_priorite=true; v_credit_lassi=3000; v_carrousel=3; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang = 4  THEN
        v_badge='Top 4 National';    v_certificat=true; v_priorite=true; v_credit_lassi=2000; v_carrousel=2; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang = 5  THEN
        v_badge='Top 5 National';    v_certificat=true; v_priorite=true; v_credit_lassi=1500; v_carrousel=1; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang <= 10 THEN
        v_badge='Top 10 National';   v_certificat=true; v_priorite=true; v_credit_lassi=1000; v_carrousel=0; v_valide_jusqu_a=v_expiry;
      ELSIF v_winner.rang <= 20 THEN
        v_badge='Top 20 National';   v_certificat=true; v_priorite=false; v_credit_lassi=0;   v_carrousel=0; v_valide_jusqu_a=NULL;
      ELSE
        v_badge='Top 40 National';   v_certificat=false; v_priorite=false; v_credit_lassi=0;  v_carrousel=0; v_valide_jusqu_a=NULL;
      END IF;

      -- ── Insérer la récompense ────────────────────────────────────────────
      INSERT INTO recompenses_attribuees (
        prestataire_id, client_id, type_classement, periode, rang,
        badge, certificat, priorite_recherche, credit_lassi,
        carrousel_produits, top_vip, valide_jusqu_a, est_actif
      ) VALUES (
        v_winner.prestataire_id, NULL, 'mondial', v_periode, v_winner.rang,
        v_badge, v_certificat, v_priorite, v_credit_lassi,
        v_carrousel, false, v_valide_jusqu_a, true
      );

      -- ── Créditer le portefeuille (si crédit > 0) ────────────────────────
      IF v_credit_lassi > 0 THEN
        SELECT id INTO v_shop_id
        FROM shops
        WHERE merchant_id = v_winner.prestataire_id
        LIMIT 1;

        IF v_shop_id IS NOT NULL THEN
          SELECT increment_shop_credit(v_shop_id, v_credit_lassi) INTO v_credit;
          RAISE NOTICE 'Rang % — % FCFA crédités (shop %)', v_winner.rang, v_credit_lassi, v_shop_id;
        ELSE
          RAISE WARNING 'Rang % — boutique introuvable pour prestataire %', v_winner.rang, v_winner.prestataire_id;
        END IF;
      END IF;

      -- ── Notification in-app ─────────────────────────────────────────────
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_winner.prestataire_id,
        'vip',
        CASE WHEN v_winner.rang <= 3
          THEN 'Classement Juillet 2026 — Félicitations'
          ELSE 'Classement Juillet 2026 — Vos résultats'
        END,
        format(
          'Vous terminez %se du classement national Juillet 2026. Badge : %s%s.',
          v_winner.rang,
          v_badge,
          CASE WHEN v_credit_lassi > 0 THEN format(' · %s FCFA de crédit LASSI', v_credit_lassi) ELSE '' END
        ),
        jsonb_build_object('type_classement','mondial','periode',v_periode,'rang',v_winner.rang)
      );

      RAISE NOTICE 'Rang % attribué — %', v_winner.rang, v_badge;

    END;
  END LOOP;

  RAISE NOTICE 'Attribution juillet 2026 terminée avec succès.';
END;
$$;
