import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { IncomingOrder } from '../../types/orders';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFlash = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke={colors.accent} />
  </Svg>
);

const IcoClock = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} />
  </Svg>
);

const IcoBell = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="#5a5c80" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke="#5a5c80" />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

// ─── Slots de temps ───────────────────────────────────────────────────────────

const FAST_SLOTS  = ['5-10 min', '10-15 min', '15-20 min', '20-30 min', '30-45 min', '45-60 min'];
const SLOW_SLOTS  = ['1h - 2h', '2h - 3h', "Aujourd'hui", 'Demain'];
const CUSTOM_SLOT = '+ Perso';

const BOTTOM_PAD = Platform.OS === 'ios' ? 28 : 14;

// Découpe en rangées de 3
function rows<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 3) out.push(arr.slice(i, i + 3));
  return out;
}

// ─── Grille de créneaux ───────────────────────────────────────────────────────

interface GridProps {
  slots:    string[];
  selected: string;
  custom?:  boolean;   // ajoute le bouton "+ Perso" en fin de grille
  onSelect: (s: string) => void;
}

function TimeGrid({ slots, selected, custom, onSelect }: GridProps) {
  const all = custom ? [...slots, CUSTOM_SLOT] : slots;
  return (
    <View style={sg.grid}>
      {rows(all).map((row, ri) => (
        <View key={ri} style={sg.row}>
          {row.map((slot) => {
            const isCustom = slot === CUSTOM_SLOT;
            const isSel    = slot === selected && !isCustom;
            return (
              <TouchableOpacity
                key={slot}
                style={[
                  sg.slot,
                  isSel    && sg.slotSel,
                  isCustom && sg.slotCustom,
                ]}
                onPress={() => !isCustom && onSelect(slot)}
                activeOpacity={isCustom ? 0.5 : 0.75}
              >
                <Text style={[
                  sg.slotTxt,
                  isSel    && sg.slotTxtSel,
                  isCustom && sg.slotTxtCustom,
                ]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* Spacers si rangée incomplète */}
          {Array.from({ length: 3 - row.length }).map((_, i) => (
            <View key={`sp${i}`} style={sg.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

const sg = StyleSheet.create({
  grid: { gap: 9, marginBottom: 4 },
  row:  { flexDirection: 'row', gap: 9 },
  spacer: { flex: 1 },
  slot: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSel: {
    backgroundColor: 'rgba(253,207,52,.13)',
    borderColor: colors.accent,
  },
  slotCustom: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  slotTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  slotTxtSel:    { color: colors.accent },
  slotTxtCustom: { color: colors.muted  },
});

// ─── Sheet principale ─────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  order:    IncomingOrder | null;
  onAccept: (prepTime: string) => void;
  onClose:  () => void;
}

export default function PrepTimeSheet({ visible, order, onAccept, onClose }: Props) {
  const [selected, setSelected] = useState('5-10 min');

  if (!order) return null;

  const summaryItems = order.items
    .map(i => `${i.qty}× ${i.name}`)
    .join(', ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Fond sombre */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
        <View style={styles.grab} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Mini carte client */}
          <View style={styles.clientCard}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarTxt}>{order.initial}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{order.clientName}</Text>
              <Text style={styles.clientSub} numberOfLines={1}>
                {order.orderId} · {summaryItems}
              </Text>
            </View>
            <Text style={styles.clientTotal}>
              {order.total.toLocaleString('fr-FR')} F
            </Text>
          </View>

          {/* Titre */}
          <Text style={styles.sheetTitle}>Prête dans combien de temps ?</Text>
          <Text style={styles.sheetSub}>Le client sera prévenu automatiquement.</Text>

          {/* Groupe Rapide */}
          <View style={styles.groupLabel}>
            <IcoFlash />
            <Text style={styles.groupTxt}>Rapide</Text>
          </View>
          <TimeGrid slots={FAST_SLOTS} selected={selected} onSelect={setSelected} />

          {/* Groupe Plus long */}
          <View style={[styles.groupLabel, { marginTop: 14 }]}>
            <IcoClock />
            <Text style={styles.groupTxt}>Plus long</Text>
          </View>
          <TimeGrid slots={SLOW_SLOTS} selected={selected} custom onSelect={setSelected} />

          {/* Bouton confirmer */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onAccept(selected)}
            activeOpacity={0.85}
          >
            <IcoCheck />
            <Text style={styles.confirmTxt}>Accepter · prête dans {selected}</Text>
          </TouchableOpacity>

          {/* Note notification */}
          <View style={styles.notifNote}>
            <IcoBell />
            <Text style={styles.notifTxt}>
              {order.clientName.split(' ')[0]} recevra une notification
            </Text>
          </View>

          <View style={{ height: 8 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,24,.65)',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Mini carte client
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clientAvatarTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  clientInfo: { flex: 1, minWidth: 0 },
  clientName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  clientSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },
  clientTotal: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
    flexShrink: 0,
  },

  sheetTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    marginBottom: 4,
  },
  sheetSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginBottom: 18,
  },

  groupLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  groupTxt: {
    color: colors.muted,
    fontFamily: fonts.titleXL,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  confirmBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  confirmTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15.5,
  },

  notifNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
  },
  notifTxt: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
