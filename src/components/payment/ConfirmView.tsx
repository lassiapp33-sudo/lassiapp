import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { OrderInfo, PayMethod } from '../../types/payment';
import { LassiMascotte } from '../LassiMascotte';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke="#fff" />
  </Svg>
);

const IcoDownload = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={colors.white} />
    <Path d="M7 10l5 5 5-5" stroke={colors.white} />
    <Path d="M12 15V3" stroke={colors.white} />
  </Svg>
);

// ─── Formatage de la date ─────────────────────────────────────────────────────

const MONTHS = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin',
                'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatDate(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${h}:${m}`;
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 20;

const METHOD_LABEL: Record<PayMethod, string> = { wave: 'Wave', om: 'Orange Money' };

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  order:         OrderInfo;
  method:        PayMethod;
  onBackToChat:  () => void;
}

export default function ConfirmView({ order, method, onBackToChat }: Props) {
  // Stable à chaque render — généré une seule fois à l'affichage de la confirmation
  const [receiptId] = useState(() =>
    `${order.orderId.replace('#', '')}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_PAD }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Mascotte célébration ─────────────────────────────────────────── */}
      <LassiMascotte
        forme="welcome"
        animation="jelly"
        taille={120}
        style={{ marginBottom: 8 }}
      />

      {/* ── Cercle de validation ─────────────────────────────────────────── */}
      {/* Anneau externe (border only, transparent fill) */}
      <View style={styles.outerRing}>
        {/* Cercle fond vert pâle */}
        <View style={styles.checkBg}>
          {/* Icône check plein */}
          <View style={styles.checkInner}>
            <IcoCheck />
          </View>
        </View>
      </View>

      {/* ── Titre + montant ──────────────────────────────────────────────── */}
      <Text style={styles.title}>Paiement réussi !</Text>
      <Text style={styles.amount}>{order.total.toLocaleString('fr-FR')} F</Text>
      <Text style={styles.desc}>
        {'Ta commande chez '}
        <Text style={styles.descBold}>{order.shopName}</Text>
        {' est confirmée.\nElle sera prête dans 5 min 🎉'}
      </Text>

      {/* ── Reçu ────────────────────────────────────────────────────────── */}
      <View style={styles.receipt}>
        <ReceiptRow label="Reçu N°"  value={`#${receiptId}`} />
        <ReceiptRow label="Méthode"  value={METHOD_LABEL[method]} />
        <ReceiptRow label="Date"     value={formatDate()} />
        <ReceiptRow label="Statut"   value="✓ Confirmé" valueColor={colors.success} last />
      </View>

      {/* ── Boutons ──────────────────────────────────────────────────────── */}
      <View style={styles.btns}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onBackToChat} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryTxt}>Retour à la conversation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} activeOpacity={0.8}>
          <IcoDownload />
          <Text style={styles.btnSecondaryTxt}>Télécharger le reçu</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Ligne de reçu ────────────────────────────────────────────────────────────

function ReceiptRow({ label, value, valueColor, last }: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <View style={[styles.rl, !last && styles.rlBorder]}>
      <Text style={styles.rlKey}>{label}</Text>
      <Text style={[styles.rlVal, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
  },

  // Cercle validation — 3 couches concentriques
  outerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(95,211,138,.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(95,211,138,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 23,
    marginBottom: 8,
    textAlign: 'center',
  },
  amount: {
    color: colors.success,
    fontFamily: fonts.titleXL,
    fontSize: 30,
    marginBottom: 6,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 26,
    textAlign: 'center',
  },
  descBold: {
    color: colors.white,
    fontFamily: fonts.title,
  },

  // Reçu
  receipt: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 15,
    marginBottom: 24,
  },
  rl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  rlBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rlKey: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  rlVal: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },

  // Boutons
  btns: {
    width: '100%',
    gap: 10,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  btnSecondary: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnSecondaryTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
