import React, { useRef, useEffect, useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';

import ChatHeader    from '../../components/chat/ChatHeader';
import DaySeparator  from '../../components/chat/DaySeparator';
import BubbleText    from '../../components/chat/BubbleText';
import BubbleVoice   from '../../components/chat/BubbleVoice';
import BubbleTicket, { TicketItem } from '../../components/chat/BubbleTicket';
import QuickReplies  from '../../components/chat/QuickReplies';
import ChatComposer  from '../../components/chat/ChatComposer';
import { colors }    from '../../theme';
import { OrderInfo } from '../../types/payment';

// ─── Types messages ───────────────────────────────────────────────────────────

type Sender = 'me' | 'them';

interface BaseMsg  { id: string; sender: Sender; time: string; }
interface TextMsg  extends BaseMsg { kind: 'text';   text: string; read?: boolean; }
interface VoiceMsg extends BaseMsg { kind: 'voice';  duration: string; read?: boolean; }
interface TicketMsg extends BaseMsg {
  kind:    'ticket';
  orderId: string;
  items:   TicketItem[];
  total:   number;
  paid:    boolean;
  read?:   boolean;
}

type Msg = TextMsg | VoiceMsg | TicketMsg;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Suggestions rapides ──────────────────────────────────────────────────────

const QUICK_CHIPS = [
  "👍 C'est noté",
  "📍 J'arrive dans 5 min",
  'Combien je te dois ?',
  'Merci ! 🙏',
];

// ─── Mock : conversation initiale (3 messages — le paiement arrive en live) ──

const TICKET_ID = 'tk1';

const INITIAL_MSGS: Msg[] = [
  {
    id: 'v1', kind: 'voice', sender: 'me',
    time: '08:12', duration: '0:09', read: true,
  },
  {
    id: 't1', kind: 'text', sender: 'them',
    time: '08:12',
    text: 'Waw ! 2 pains-œufs et un café Touba bien sucré. Je te prépare ça 👍',
  },
  {
    id: TICKET_ID, kind: 'ticket', sender: 'them',
    time: '08:13', orderId: '#A427', paid: false,
    items: [
      { qty: 2, name: 'Pain Œuf Mayo', price: 1000 },
      { qty: 1, name: 'Café Touba',    price: 200  },
    ],
    total: 1200,
  },
];

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  shopInitial:  string;
  shopName:     string;
  isVip?:       boolean;
  onBack:       () => void;
  // Paiement via PaymentScreen
  onCheckout?:  (order: OrderInfo) => void;
  // Retour de PaymentScreen avec succès → ticketId à marquer payé
  paidTicketId?: string;
}

export default function ChatScreen({
  shopInitial, shopName, isVip,
  onBack, onCheckout, paidTicketId,
}: Props) {
  const [messages,  setMessages]  = useState<Msg[]>(INITIAL_MSGS);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Évite de re-traiter le même paiement si le composant re-rend
  const processedPayments = useRef<Set<string>>(new Set());

  // Scroll vers le bas à chaque nouveau message
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages]);

  // Retour de PaymentScreen → marquer le ticket comme payé dans le chat
  useEffect(() => {
    if (!paidTicketId || processedPayments.current.has(paidTicketId)) return;
    processedPayments.current.add(paidTicketId);
    applyPayment(paidTicketId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidTicketId]);

  // ── Marquer un ticket payé + ajouter reçu + réponse commerçant ────────────
  const applyPayment = (ticketId: string) => {
    setMessages(prev => {
      const ticket = prev.find(m => m.id === ticketId) as TicketMsg | undefined;
      if (!ticket) return prev;
      const updated = prev.map(m => m.id === ticketId ? { ...m, paid: true } : m);
      const receipt: TicketMsg = {
        id: `receipt_${ticketId}`, kind: 'ticket', sender: 'me',
        time: nowTime(), orderId: ticket.orderId,
        items: ticket.items, total: ticket.total, paid: true, read: true,
      };
      return [...updated, receipt];
    });
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `confirm_${ticketId}`, kind: 'text', sender: 'them',
        time: nowTime(),
        text: 'Reçu ✅ Ta commande sera prête dans 5 min. À tout de suite !',
      }]);
    }, 1400);
  };

  // ── Bouton "Payer" sur un ticket ──────────────────────────────────────────
  const handleTicketPay = (ticketId: string) => {
    const ticket = messages.find(m => m.id === ticketId) as TicketMsg | undefined;
    if (!ticket || ticket.paid) return;

    if (onCheckout) {
      // Ouvre l'écran de paiement complet (PaymentScreen)
      const order: OrderInfo = {
        ticketId,
        orderId:      ticket.orderId,
        shopInitial,
        shopName,
        shopLocation: '📍 Medina · à emporter',
        items:        ticket.items,
        total:        ticket.total,
      };
      onCheckout(order);
    } else {
      // Fallback : paiement local simulé (mode standalone)
      applyPayment(ticketId);
    }
  };

  // ── Envoyer texte / vocal ─────────────────────────────────────────────────
  const handleSend = () => {
    const text = inputText.trim();
    if (!text) {
      setMessages(prev => [...prev, {
        id: `voice_${Date.now()}`, kind: 'voice', sender: 'me',
        time: nowTime(), duration: '0:05', read: false,
      }]);
      return;
    }
    setMessages(prev => [...prev, {
      id: `msg_${Date.now()}`, kind: 'text', sender: 'me',
      time: nowTime(), text, read: false,
    }]);
    setInputText('');
  };

  // ── Rendu d'un message ────────────────────────────────────────────────────
  const renderMsg = (msg: Msg) => {
    switch (msg.kind) {
      case 'text':
        return <BubbleText key={msg.id} text={msg.text} sender={msg.sender} time={msg.time} read={msg.read} />;
      case 'voice':
        return <BubbleVoice key={msg.id} sender={msg.sender} duration={msg.duration} time={msg.time} read={msg.read} />;
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
        initial={shopInitial}
        name={shopName}
        isVip={isVip}
        isOnline
        onBack={onBack}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DaySeparator label="Aujourd'hui · 08:12" />
        {messages.map(renderMsg)}
      </ScrollView>
      <QuickReplies chips={QUICK_CHIPS} onSelect={setInputText} />
      <ChatComposer value={inputText} onChange={setInputText} onSend={handleSend} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
});
