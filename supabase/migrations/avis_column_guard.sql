-- ===========================================================================
-- LASSI — Guard colonnes avis pour les marchands
-- RLS ne peut pas restreindre les colonnes modifiables (pas d'accès à OLD).
-- Ce trigger BEFORE UPDATE empêche un marchand de toucher à autre chose
-- que reponse_commercant sur les avis de sa boutique.
-- SAFE à re-exécuter (CREATE OR REPLACE + DROP/CREATE trigger).
-- ===========================================================================

CREATE OR REPLACE FUNCTION fn_avis_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- L'auteur peut modifier toutes ses colonnes (note, commentaire, photo)
  IF auth.uid() = OLD.author_id THEN
    RETURN NEW;
  END IF;

  -- Un admin peut tout modifier (masque notamment)
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RETURN NEW;
  END IF;

  -- Un marchand peut UNIQUEMENT modifier reponse_commercant
  IF EXISTS (SELECT 1 FROM shops WHERE id = OLD.shop_id AND merchant_id = auth.uid()) THEN
    IF NEW.note              IS DISTINCT FROM OLD.note
    OR NEW.commentaire       IS DISTINCT FROM OLD.commentaire
    OR NEW.photo_url         IS DISTINCT FROM OLD.photo_url
    OR NEW.author_name       IS DISTINCT FROM OLD.author_name
    OR NEW.author_id         IS DISTINCT FROM OLD.author_id
    OR NEW.shop_id           IS DISTINCT FROM OLD.shop_id
    OR NEW.order_id          IS DISTINCT FROM OLD.order_id
    OR NEW.masque            IS DISTINCT FROM OLD.masque
    THEN
      RAISE EXCEPTION
        'Le prestataire ne peut modifier que sa réponse (reponse_commercant).'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
    RETURN NEW;
  END IF;

  -- Tout autre cas est déjà bloqué par RLS — sécurité en profondeur
  RAISE EXCEPTION 'Modification non autorisée.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_column_guard ON avis;
CREATE TRIGGER trg_avis_column_guard
  BEFORE UPDATE ON avis
  FOR EACH ROW
  EXECUTE FUNCTION fn_avis_column_guard();

-- ===========================================================================
-- ROLLBACK
-- DROP TRIGGER IF EXISTS trg_avis_column_guard ON avis;
-- DROP FUNCTION IF EXISTS fn_avis_column_guard();
-- ===========================================================================
