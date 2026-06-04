import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';

import ChatHeader from '../../components/chat/ChatHeader';
import DaySeparator from '../../components/chat/DaySeparator';
import BubbleText from '../../components/chat/BubbleText';
import BubbleVoice from '../../components/chat/BubbleVoice';
import BubbleImage from '../../components/chat/BubbleImage';
import BubbleTicket, { TicketItem } from '../../components/chat/BubbleTicket';
import QuickReplies from '../../components/chat/QuickReplies';
import ChatComposer from '../../components/chat/ChatComposer';
import AttachSheet from '../../components/chat/AttachSheet';
import { colors } from '../../theme';
import { OrderInfo } from '../../types/payment';
import useAuthStore from '../../store/authStore';
import * as chatService from '../../services/chat';
import * as shopsService from '../../services/shops';
import { openDirectPhoneCall } from '../../utils/whatsapp';
import { ChatMessage } from '../../services/chat';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import logger from '../../utils/logger';
import { formatTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/errorUtils';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─── Types locaux UI ──────────────────────────────────────────────────────────

type Sender = 'me' | 'them';

interface BaseMsg {
  id: string;
  sender: Sender;
  time: string;
}
interface TextMsg extends BaseMsg {
  kind: 'text';
  text: string;
  read?: boolean;
}
interface VoiceMsg extends BaseMsg {
  kind: 'voice';
  duration: string;
  voiceUrl?: string | null;
  read?: boolean;
}
interface ImageMsg extends BaseMsg {
  kind: 'image';
  imageUrl: string;
  read?: boolean;
}
interface TicketMsg extends BaseMsg {
  kind: 'ticket';
  orderId: string;
  items: TicketItem[];
  total: number;
  paid: boolean;
  read?: boolean;
}
type Msg = TextMsg | VoiceMsg | ImageMsg | TicketMsg;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Convertit un ChatMessage Supabase en Msg local
function toMsg(m: ChatMessage, currentUserId: string): Msg {
  const sender: Sender = m.senderId === currentUserId ? 'me' : 'them';
  const time = formatTime(m.createdAt);

  if (m.type === 'ticket' && m.ticketData) {
    return {
      id: m.id,
      kind: 'ticket',
      sender,
      time,
      orderId: m.ticketData.orderId,
      items: m.ticketData.items,
      total: m.ticketData.total,
      paid: m.ticketData.status === 'paid',
    };
  }
  if (m.type === 'voice') {
    // content stocke la durée en secondes (ex : "15")
    const sec = parseInt(m.content || '0', 10);
    const min = Math.floor(sec / 60);
    const duration = `${min}:${String(sec % 60).padStart(2, '0')}`;
    return { id: m.id, kind: 'voice', sender, time, duration, voiceUrl: m.voiceUrl };
  }
  if (m.type === 'image') {
    return { id: m.id, kind: 'image', sender, time, imageUrl: m.voiceUrl ?? '' };
  }
  return { id: m.id, kind: 'text', sender, time, text: m.content };
}

const QUICK_CHIPS = [
  "👍 C'est noté",
  "📍 J'arrive dans 5 min",
  'Combien je te dois ?',
  'Merci ! 🙏',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  shopId?: string;
  conversationId?: string;
  shopInitial: string;
  shopName: string;
  shopLogoUrl?: string | null;
  isVip?: boolean;
  onBack: () => void;
  onCheckout?: (order: OrderInfo) => void;
  paidTicketId?: string;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function ChatScreen({
  shopId,
  conversationId: directConvId,
  shopInitial,
  shopName,
  shopLogoUrl,
  isVip,
  onBack,
  onCheckout,
  paidTicketId,
}: Props) {
  const currentUserId = useAuthStore(s => s.user?.id ?? '');
  const userRole = useAuthStore(s => s.user?.role ?? 'client');

  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(directConvId ?? null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  // Nom/avatar/initiale/téléphone/vip résolus depuis Supabase — remplacent les props si besoin
  const [resolvedName, setResolvedName] = useState(shopName);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(shopLogoUrl ?? null);
  const [resolvedInitial, setResolvedInitial] = useState(shopInitial);
  const [resolvedIsVip, setResolvedIsVip] = useState<boolean>(isVip ?? false);
  const [otherPhone, setOtherPhone] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const processedPayments = useRef<Set<string>>(new Set());
  // IDs déjà dans le state — évite les doublons Realtime
  const knownIds = useRef<Set<string>>(new Set());
  const isMounted = useRef(true);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Annule toutes les mises à jour async en vol au démontage
  useEffect(() => {
    return () => {
      isMounted.current = false;
      pendingTimers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages]);

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let convId = directConvId ?? null;
        if (!convId) {
          if (!shopId) return;
          const conv = await chatService.getOrCreateConversation(shopId);
          convId = conv.id;
        }
        if (cancelled) return;
        setConversationId(convId);

        // ── Résolution du vrai nom/avatar de l'interlocuteur depuis Supabase ──
        // Garantit que le header affiche toujours le vrai nom, même si les props
        // contenaient un placeholder ("...", "", "Client", etc.).
        try {
          if (userRole === 'client' && shopId) {
            // Client avec shopId fourni → fetch la boutique directement
            const shop = await shopsService.getShopById(shopId);
            if (shop && !cancelled) {
              setResolvedName(shop.name);
              setResolvedLogoUrl(shop.logoUrl ?? null);
              setResolvedInitial(shop.name.charAt(0).toUpperCase());
              setResolvedIsVip(shop.isVip);
              let phone = shop.phone ?? null;
              // Fallback : si la boutique n'a pas de tél, tente le profil du marchand
              if (!phone && shop.merchantId) {
                const mp = await chatService.getClientProfile(shop.merchantId);
                phone = mp.phone ?? null;
              }
              setOtherPhone(phone);
            }
          } else {
            // Client sans shopId (navigation via notification) ou marchand → lit la conv
            const conv = await chatService.getConversationById(convId);
            if (conv) {
              if (userRole === 'client') {
                const shop = await shopsService.getShopById(conv.shopId);
                if (shop && !cancelled) {
                  setResolvedName(shop.name);
                  setResolvedLogoUrl(shop.logoUrl ?? null);
                  setResolvedInitial(shop.name.charAt(0).toUpperCase());
                  setResolvedIsVip(shop.isVip);
                  let phone = shop.phone ?? null;
                  if (!phone && shop.merchantId) {
                    const mp = await chatService.getClientProfile(shop.merchantId);
                    phone = mp.phone ?? null;
                  }
                  setOtherPhone(phone);
                }
              } else {
                // Marchand → l'interlocuteur est le client
                const profile = await chatService.getClientProfile(conv.clientId);
                if (!cancelled) {
                  const displayName = profile.name || 'Client';
                  setResolvedName(displayName);
                  setResolvedLogoUrl(profile.avatarUrl);
                  setResolvedInitial(displayName.charAt(0).toUpperCase());
                  setOtherPhone(profile.phone ?? null);
                }
              }
            }
          }
        } catch {}

        const msgs = await chatService.getMessages(convId);
        const mapped = msgs.map(m => toMsg(m, currentUserId));
        mapped.forEach(m => knownIds.current.add(m.id));
        if (!cancelled) {
          setMessages(mapped);
          await chatService.markConversationRead(convId);
        }
      } catch (err) {
        logger.warn('[ChatScreen] init:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, directConvId, currentUserId, userRole]);

  // ── Marquer ticket payé localement + message de confirmation ─────────────
  // useCallback([]) : setMessages et les refs sont stables, pas de dépendances réactives
  const applyPayment = useCallback((ticketId: string) => {
    if (!isMounted.current) return;
    setMessages(prev => {
      const ticket = prev.find(m => m.id === ticketId) as TicketMsg | undefined;
      if (!ticket) return prev;
      const updated = prev.map(m => (m.id === ticketId ? { ...m, paid: true } : m));
      const receipt: TicketMsg = {
        id: `receipt_${ticketId}`,
        kind: 'ticket',
        sender: 'me',
        time: nowTime(),
        orderId: ticket.orderId,
        items: ticket.items,
        total: ticket.total,
        paid: true,
        read: true,
      };
      return [...updated, receipt];
    });
    const t = setTimeout(() => {
      if (!isMounted.current) return;
      setMessages(prev => [
        ...prev,
        {
          id: `confirm_${ticketId}`,
          kind: 'text',
          sender: 'them',
          time: nowTime(),
          text: 'Reçu ✅ Ta commande sera prête dans 5 min. À tout de suite !',
        },
      ]);
    }, 1400);
    pendingTimers.current.push(t);
  }, []);

  // ── Retour de PaymentScreen → marquer ticket payé ─────────────────────────
  useEffect(() => {
    if (!paidTicketId || processedPayments.current.has(paidTicketId)) return;
    processedPayments.current.add(paidTicketId);
    applyPayment(paidTicketId);
    if (conversationId) {
      chatService
        .updateTicketStatus(paidTicketId)
        .catch(err => logger.warn('[ChatScreen] updateTicketStatus:', err));
    }
  }, [paidTicketId, conversationId, applyPayment]);

  // ── Abonnement Realtime ───────────────────────────────────────────────────
  const handleInsert = useCallback(
    (msg: ChatMessage) => {
      if (knownIds.current.has(msg.id)) return; // déjà dans le state
      knownIds.current.add(msg.id);
      setMessages(prev => [...prev, toMsg(msg, currentUserId)]);
    },
    [currentUserId],
  );

  const handleUpdate = useCallback(
    (msg: ChatMessage) => {
      setMessages(prev => prev.map(m => (m.id === msg.id ? toMsg(msg, currentUserId) : m)));
    },
    [currentUserId],
  );

  useRealtimeMessages(conversationId, handleInsert, handleUpdate);

  // ── Bouton "Payer" sur un ticket ──────────────────────────────────────────
  const handleTicketPay = (ticketId: string) => {
    const ticket = messages.find(m => m.id === ticketId) as TicketMsg | undefined;
    if (!ticket || ticket.paid) return;

    if (onCheckout) {
      onCheckout({
        ticketId,
        orderId: ticket.orderId,
        shopInitial: resolvedInitial,
        shopName: resolvedName,
        shopLocation: '📍',
        items: ticket.items,
        total: ticket.total,
        orderType: 'emporter',
      });
    } else {
      applyPayment(ticketId);
    }
  };

  // ── Envoi d'un message texte ─────────────────────────────────────────────
  const handleSend = async () => {
    if (!conversationId) return;

    const text = inputText.trim();
    if (!text) return;
    const tempId = `tmp_${Date.now()}`;

    const textMsg: TextMsg = { id: tempId, kind: 'text', sender: 'me', time: nowTime(), text };
    knownIds.current.add(tempId);
    setMessages(prev => [...prev, textMsg]);
    setInputText('');

    try {
      const saved = await chatService.sendMessage(conversationId, { type: 'text', content: text });
      if (!isMounted.current) return;
      knownIds.current.add(saved.id);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, id: saved.id } : m)));
    } catch (err) {
      logger.warn('[ChatScreen] sendMessage:', err);
    }
  };

  // ── Envoi d'un message vocal réel ────────────────────────────────────────
  const handleVoiceSend = async (localUri: string, durationSec: number) => {
    if (!conversationId) return;

    const min = Math.floor(durationSec / 60);
    const duration = `${min}:${String(durationSec % 60).padStart(2, '0')}`;

    // Optimiste : bulle affichée immédiatement (sans URL encore)
    const tempId = `voice_${Date.now()}`;
    const voiceMsg: VoiceMsg = {
      id: tempId,
      kind: 'voice',
      sender: 'me',
      time: nowTime(),
      duration,
      voiceUrl: null,
    };
    knownIds.current.add(tempId);
    setMessages(prev => [...prev, voiceMsg]);

    try {
      // 1. Upload vers Supabase Storage
      const voiceUrl = await chatService.uploadVoiceMessage(localUri, conversationId);

      // 2. Sauvegarder en base — content = durée en secondes
      const saved = await chatService.sendMessage(conversationId, {
        type: 'voice',
        content: String(durationSec),
        voiceUrl,
      });

      // 3. Mettre à jour la bulle avec la vraie URL et l'ID Supabase
      if (!isMounted.current) return;
      knownIds.current.add(saved.id);
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, id: saved.id, voiceUrl: saved.voiceUrl } : m)),
      );
    } catch (err: unknown) {
      logger.warn('[ChatScreen] handleVoiceSend:', getErrorMessage(err));
      if (!isMounted.current) return;
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Envoi échoué', getErrorMessage(err, 'Erreur inconnue'));
    }
  };

  // ── Envoi d'une image ────────────────────────────────────────────────────
  const handleImageSend = async (localUri: string) => {
    if (!conversationId) return;

    const tempId = `img_${Date.now()}`;
    const imageMsg: ImageMsg = {
      id: tempId,
      kind: 'image',
      sender: 'me',
      time: nowTime(),
      imageUrl: localUri, // URI local affiché en attendant l'upload
    };
    knownIds.current.add(tempId);
    setMessages(prev => [...prev, imageMsg]);

    try {
      const imageUrl = await chatService.uploadChatImage(localUri, conversationId);
      const saved = await chatService.sendMessage(conversationId, {
        type: 'image',
        content: '📷',
        voiceUrl: imageUrl,
      });
      if (!isMounted.current) return;
      knownIds.current.add(saved.id);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, id: saved.id, imageUrl } : m)));
    } catch (err: unknown) {
      logger.warn('[ChatScreen] handleImageSend:', getErrorMessage(err));
      if (!isMounted.current) return;
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Envoi échoué', getErrorMessage(err, 'Erreur inconnue'));
    }
  };

  // ── Rendu d'un message ────────────────────────────────────────────────────
  const renderMsg = (msg: Msg) => {
    switch (msg.kind) {
      case 'text':
        return (
          <BubbleText
            key={msg.id}
            text={msg.text}
            sender={msg.sender}
            time={msg.time}
            read={msg.read}
          />
        );
      case 'voice':
        return (
          <BubbleVoice
            key={msg.id}
            duration={msg.duration}
            voiceUrl={msg.voiceUrl}
            sender={msg.sender}
            time={msg.time}
            read={msg.read}
          />
        );
      case 'image':
        return (
          <BubbleImage
            key={msg.id}
            imageUrl={msg.imageUrl}
            sender={msg.sender}
            time={msg.time}
            read={msg.read}
          />
        );
      case 'ticket':
        return (
          <BubbleTicket
            key={msg.id}
            sender={msg.sender}
            orderId={msg.orderId}
            items={msg.items}
            total={msg.total}
            paid={msg.paid}
            time={msg.time}
            read={msg.read}
            onPay={!msg.paid ? () => handleTicketPay(msg.id) : undefined}
          />
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ChatHeader
        initial={resolvedInitial}
        name={resolvedName}
        isVip={resolvedIsVip}
        isOnline
        onBack={onBack}
        logoUrl={resolvedLogoUrl}
        onCall={() => openDirectPhoneCall(otherPhone)}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <DaySeparator label="Aujourd'hui" />
          {messages.map(renderMsg)}
        </ScrollView>
      )}

      <QuickReplies chips={QUICK_CHIPS} onSelect={setInputText} />
      <ChatComposer
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        onVoiceSend={handleVoiceSend}
        onAttach={() => setShowAttach(true)}
      />

      <AttachSheet
        visible={showAttach}
        onClose={() => setShowAttach(false)}
        onImagePicked={handleImageSend}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 18, gap: 12 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
