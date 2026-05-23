import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBook = ({ stroke }: { stroke: string }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke={stroke} />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke={stroke} />
  </Svg>
);

const IcoPlus = ({ stroke }: { stroke: string }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5v14" stroke={stroke} />
  </Svg>
);

const IcoMsg = ({ stroke }: { stroke: string }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={stroke} />
  </Svg>
);

const IcoGrid = ({ stroke }: { stroke: string }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={stroke} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={stroke} />
  </Svg>
);

// ─── Configuration des 4 actions ─────────────────────────────────────────────

const ACTIONS = [
  {
    key: 'debts',
    Icon: IcoBook,
    iconBg: 'rgba(253,207,52,.13)',
    iconStroke: colors.accent,
    title: 'Cahier de dettes',
    desc:  '3 relances à faire',
    badge: 3,
  },
  {
    key: 'sale',
    Icon: IcoPlus,
    iconBg: 'rgba(95,211,138,.13)',
    iconStroke: colors.success,
    title: 'Nouvelle vente',
    desc:  'Enregistrer en 2 clics',
    badge: undefined,
  },
  {
    key: 'orders',
    Icon: IcoMsg,
    iconBg: 'rgba(29,200,242,.13)',
    iconStroke: '#1DC8F2',
    title: 'Commandes',
    desc:  '2 nouvelles',
    badge: 2,
  },
  {
    key: 'store',
    Icon: IcoGrid,
    iconBg: 'rgba(240,168,71,.13)',
    iconStroke: colors.orange,
    title: 'Ma vitrine',
    desc:  'Gérer mes produits',
    badge: undefined,
  },
] as const;

// ─── Carte d'action individuelle ──────────────────────────────────────────────

interface ActionCardProps {
  item:    typeof ACTIONS[number];
  onPress?: () => void;
}

function ActionCard({ item, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Icône dans son carré coloré */}
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <item.Icon stroke={item.iconStroke} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.desc}</Text>

      {/* Badge rouge (nombre d'alertes) */}
      {item.badge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{item.badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Grille 2×2 ──────────────────────────────────────────────────────────────

interface Props {
  onPress?: (key: string) => void;
}

export default function QuickActions({ onPress }: Props) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <ActionCard item={ACTIONS[0]} onPress={() => onPress?.('debts')} />
        <ActionCard item={ACTIONS[1]} onPress={() => onPress?.('sale')} />
      </View>
      <View style={styles.row}>
        <ActionCard item={ACTIONS[2]} onPress={() => onPress?.('orders')} />
        <ActionCard item={ACTIONS[3]} onPress={() => onPress?.('store')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 11,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 11,
  },

  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 15,
    position: 'relative',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },

  badge: {
    position: 'absolute',
    top: 13,
    right: 13,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
});
