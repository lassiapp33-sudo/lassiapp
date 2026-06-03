import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { getReceipt, ReceiptInfo, ReceiptStatus } from '../../services/receipts';
import { contacterServiceClient } from '../../config/contact';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoRefresh = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 4v6h6M23 20v-6h-6" stroke={colors.muted} />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke={colors.muted} />
  </Svg>
);

const IcoWhatsApp = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Compte à rebours ─────────────────────────────────────────────────────────

function useCountdown(validUntilISO: string | undefined) {
  const [remaining, setRemaining] = useState(() =>
    validUntilISO
      ? Math.max(0, new Date(validUntilISO).getTime() - Date.now())
      : 0
  );

  useEffect(() => {
    if (!validUntilISO) return;
    const tick = () => {
      const r = Math.max(0, new Date(validUntilISO).getTime() - Date.now());
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [validUntilISO]);

  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return { remaining, mm, ss, expired: remaining === 0 };
}

// ─── Badge statut reçu ───────────────────────────────────────────────────────

const STATUS_CFG: Record<ReceiptStatus, { label: string; color: string; bg: string }> = {
  aucun:   { label: 'En attente',  color: colors.muted,   bg: 'rgba(154,155,176,0.12)' },
  valide:  { label: 'Valide',      color: colors.success, bg: 'rgba(95,211,138,0.15)'  },
  utilise: { label: 'Utilisé',     color: colors.muted,   bg: 'rgba(154,155,176,0.12)' },
  expire:  { label: 'Expiré',      color: colors.danger,  bg: 'rgba(224,122,122,0.12)' },
};

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <View style={[s.dot, { backgroundColor: cfg.color }]} />
      <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Affichage du code en blocs lisibles (XXXX XXXX) ─────────────────────────

function CodeDisplay({ code, expired, used }: { code: string; expired: boolean; used: boolean }) {
  const dim = expired || used;
  return (
    <View style={[s.codeBox, dim && s.codeBoxDim]}>
      <Text style={[s.codeText, dim && s.codeTextDim]}>
        {code.slice(0, 4)}
        {'  '}
        {code.slice(4, 8)}
      </Text>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  orderId: string;
  onBack:  () => void;
}

export default function ReceiptScreen({ orderId, onBack }: Props) {
  const [receipt,  setReceipt]  = useState<ReceiptInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<ReceiptStatus>('aucun');

  const { mm, ss, expired } = useCountdown(
    liveStatus === 'valide' ? receipt?.receiptValidUntil : undefined
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReceipt(orderId);
      if (!data) { setError('Reçu introuvable.'); return; }
      setReceipt(data);
      setLiveStatus(data.receiptStatus);
    } catch {
      setError('Impossible de charger le reçu. Tire vers le bas pour réessayer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  // Quand le compte à rebours atteint 0, on passe localement à 'expire'
  useEffect(() => {
    if (expired && liveStatus === 'valide') setLiveStatus('expire');
  }, [expired, liveStatus]);

  const isExpired = liveStatus === 'expire';
  const isUsed    = liveStatus === 'utilise';
  const isValid   = liveStatus === 'valide';
  const dim       = isExpired || isUsed;

  const handleWhatsApp = () =>
    contacterServiceClient('Bonjour, mon reçu de commande a expiré. Pouvez-vous m\'aider ?');

  // ── En-tête ──────────────────────────────────────────────────────────────

  const Header = () => (
    <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={s.title}>Mon reçu</Text>
      <TouchableOpacity style={s.backBtn} onPress={load} activeOpacity={0.75}>
        <IcoRefresh />
      </TouchableOpacity>
    </View>
  );

  if (loading) return (
    <View style={s.root}>
      <Header />
      <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
    </View>
  );

  if (error || !receipt) return (
    <View style={s.root}>
      <Header />
      <View style={s.center}>
        <Text style={s.errorTxt}>{error ?? 'Reçu introuvable.'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={s.retryTxt}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const formattedDate = new Date(receipt.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={s.root}>
      <Header />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bloc principal reçu ── */}
        <View style={s.card}>
          {/* Shop + statut */}
          <View style={s.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.shopName} numberOfLines={1}>{receipt.shopName}</Text>
              <Text style={s.dateLabel}>{formattedDate}</Text>
            </View>
            <StatusBadge status={liveStatus} />
          </View>

          <View style={s.sep} />

          {/* Compte à rebours */}
          {isValid && (
            <View style={s.timerBox}>
              <Text style={s.timerLabel}>Valide encore</Text>
              <Text style={s.timerValue}>{mm}:{ss}</Text>
              <Text style={s.timerSub}>Présente ce reçu pour confirmer ta commande</Text>
            </View>
          )}
          {isExpired && (
            <View style={s.expireBox}>
              <Text style={s.expireTitle}>Reçu expiré</Text>
              <Text style={s.expireSub}>
                La validité de 40 min est dépassée. Contacte le prestataire
                ou notre service client pour régulariser.
              </Text>
            </View>
          )}
          {isUsed && (
            <View style={s.usedBox}>
              <Text style={s.usedTitle}>✓ Reçu utilisé</Text>
              <Text style={s.usedSub}>Ta commande a bien été remise. Merci !</Text>
            </View>
          )}

          <View style={s.sep} />

          {/* Code lisible */}
          <Text style={s.sectionLabel}>CODE DU REÇU</Text>
          <CodeDisplay
            code={receipt.receiptCode}
            expired={isExpired}
            used={isUsed}
          />

          {/* QR code */}
          <View style={[s.qrWrap, dim && s.qrWrapDim]}>
            <QRCode
              value={receipt.receiptCode}
              size={160}
              backgroundColor={colors.surface}
              color={dim ? colors.muted : colors.white}
            />
          </View>
          {isValid && (
            <Text style={s.qrHint}>
              Montre ce code ou ce QR au prestataire pour confirmer la remise
            </Text>
          )}
        </View>

        {/* ── Récapitulatif articles ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>RÉCAPITULATIF</Text>
          {receipt.items.map((item, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.itemQty}>{item.qty}×</Text>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemPrice}>{formatPrice(item.price)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmount}>{formatPrice(receipt.total)}</Text>
          </View>
        </View>

        {/* ── Contact si expiré ── */}
        {isExpired && (
          <TouchableOpacity style={s.waBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
            <IcoWhatsApp />
            <Text style={s.waTxt}>Contacter le service client</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTxt: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20,
  },
  retryBtn: {
    paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent,
  },
  retryTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  shopName: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17, marginBottom: 3 },
  dateLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: radius.pill, flexShrink: 0,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 12 },

  sep: { height: 1, backgroundColor: colors.border, marginVertical: 14 },

  // Timer
  timerBox: { alignItems: 'center', paddingVertical: 6 },
  timerLabel: { color: colors.success, fontFamily: fonts.ui, fontSize: 12, marginBottom: 4 },
  timerValue: {
    color: colors.success, fontFamily: fonts.titleXL,
    fontSize: 46, letterSpacing: 2,
  },
  timerSub: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18,
  },

  // Expiré
  expireBox: { alignItems: 'center', paddingVertical: 8 },
  expireTitle: { color: colors.danger, fontFamily: fonts.titleXL, fontSize: 20, marginBottom: 8 },
  expireSub: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center', lineHeight: 20,
  },

  // Utilisé
  usedBox: { alignItems: 'center', paddingVertical: 8 },
  usedTitle: { color: colors.success, fontFamily: fonts.titleXL, fontSize: 20, marginBottom: 8 },
  usedSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  sectionLabel: {
    color: colors.muted, fontFamily: fonts.ui,
    fontSize: 10.5, letterSpacing: 1, marginBottom: 12,
  },

  // Code
  codeBox: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  codeBoxDim: { borderColor: 'transparent', backgroundColor: 'transparent' },
  codeText: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 32,
    letterSpacing: 8,
  },
  codeTextDim: { color: colors.muted },

  // QR
  qrWrap: { alignItems: 'center', marginBottom: 10 },
  qrWrapDim: { opacity: 0.3 },
  qrHint: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4,
  },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  itemQty: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13, width: 28 },
  itemName: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 13 },
  itemPrice: { color: colors.accent, fontFamily: fonts.title, fontSize: 13 },

  totalRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  totalAmount: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  // WhatsApp
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: radius.md,
    backgroundColor: '#25D366', marginBottom: 8,
  },
  waTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
});
