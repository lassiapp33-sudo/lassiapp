-- =============================================================================
-- LASSI Phase 3 – Étape 3 : Messagerie, notifications, temps réel
-- Supabase > SQL Editor > New query > coller tout > Run
-- =============================================================================

-- ── 1. Colonne push_token sur profiles ───────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ── 2. Table conversations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_unread    INTEGER NOT NULL DEFAULT 0,
  merchant_unread  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, shop_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- Le client voit ses propres conversations
-- Le marchand voit les conversations de sa boutique
CREATE POLICY "conv_select" ON conversations FOR SELECT
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid())
  );
CREATE POLICY "conv_insert" ON conversations FOR INSERT
  WITH CHECK (client_id = auth.uid());
CREATE POLICY "conv_update" ON conversations FOR UPDATE
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid())
  );

-- Replica identity pour le filtre Realtime
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- ── 3. Table messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('client','merchant')),
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','voice','ticket')),
  content         TEXT NOT NULL DEFAULT '',
  voice_url       TEXT,
  ticket_data     JSONB,  -- { orderId, items, total, status: 'pending'|'paid' }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- Les participants à la conversation voient et envoient des messages
CREATE POLICY "msg_select" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid() OR s.merchant_id = auth.uid())
    )
  );
CREATE POLICY "msg_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid() OR s.merchant_id = auth.uid())
    )
  );
-- Mise à jour du ticket (statut payé)
CREATE POLICY "msg_update" ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = conversation_id
        AND (c.client_id = auth.uid() OR s.merchant_id = auth.uid())
    )
  );

ALTER TABLE messages REPLICA IDENTITY FULL;

-- ── 4. Table notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('order','payment','vip','message','debt')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;

-- ── 5. Activation Realtime ────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ── 6. Trigger : nouvelle commande → notifier le marchand ─────────────────────
CREATE OR REPLACE FUNCTION notify_merchant_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = NEW.shop_id;
  IF v_merchant_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_merchant_id,
    'order',
    'Nouvelle commande ! 🛎',
    'Commande de ' || NEW.client_name || ' · ' || NEW.total || ' FCFA',
    jsonb_build_object('order_id', NEW.id, 'shop_id', NEW.shop_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_order ON orders;
CREATE TRIGGER trg_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_merchant_new_order();

-- ── 7. Trigger : changement statut commande → notifier le client ──────────────
CREATE OR REPLACE FUNCTION notify_client_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
BEGIN
  -- Pas de changement de statut ou pas de client → rien à faire
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'preparing' THEN
      v_title := 'En préparation 👨‍🍳';
      v_body  := 'Ta commande est en cours de préparation.';
    WHEN 'ready' THEN
      v_title := 'Commande prête ! 🎉';
      v_body  := 'Ta commande est prête, viens la récupérer !';
    WHEN 'done' THEN
      v_title := 'Terminée ✅';
      v_body  := 'Bonne dégustation ! Merci.';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.client_id, 'order', v_title, v_body,
    jsonb_build_object('order_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status ON orders;
CREATE TRIGGER trg_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_client_order_status();

-- ── 8. Trigger : nouveau message → notifier l'autre partie ────────────────────
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv         conversations%ROWTYPE;
  v_merchant_id  UUID;
  v_target_id    UUID;
  v_sender_name  TEXT;
  v_preview      TEXT;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  SELECT merchant_id INTO v_merchant_id FROM shops WHERE id = v_conv.shop_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  v_preview := CASE NEW.type
    WHEN 'ticket' THEN '📋 Ticket de commande'
    WHEN 'voice'  THEN '🎤 Message vocal'
    ELSE LEFT(NEW.content, 60)
  END;

  IF NEW.sender_role = 'client' THEN
    v_target_id := v_merchant_id;
    UPDATE conversations
      SET merchant_unread = merchant_unread + 1,
          last_message    = v_preview,
          last_message_at = NOW()
      WHERE id = NEW.conversation_id;
  ELSE
    v_target_id := v_conv.client_id;
    UPDATE conversations
      SET client_unread   = client_unread + 1,
          last_message    = v_preview,
          last_message_at = NOW()
      WHERE id = NEW.conversation_id;
  END IF;

  IF v_target_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_target_id, 'message',
      'Message de ' || COALESCE(v_sender_name, 'quelqu''un'),
      v_preview,
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_message ON messages;
CREATE TRIGGER trg_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
