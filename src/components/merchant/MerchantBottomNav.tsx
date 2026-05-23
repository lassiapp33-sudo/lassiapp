import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoGrid = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoBook = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke={on ? colors.accent : colors.muted} />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoPlus = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5v14" stroke={colors.bg} />
  </Svg>
);

const IcoMsg = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoProfil = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4} stroke={on ? colors.accent : colors.muted} />
    <Path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"
      stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MerchantTab = 'dashboard' | 'debts' | 'sale' | 'orders' | 'profile';

const BOTTOM_EXTRA = Platform.OS === 'ios' ? 20 : 0;
export const MERCHANT_NAV_HEIGHT = 72 + BOTTOM_EXTRA;

interface Props {
  active:   MerchantTab;
  onPress?: (tab: MerchantTab) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MerchantBottomNav({ active, onPress }: Props) {
  const press = (tab: MerchantTab) => onPress?.(tab);

  return (
    <View style={[styles.bar, { paddingBottom: BOTTOM_EXTRA + 8 }]}>
      <TouchableOpacity style={styles.item} onPress={() => press('dashboard')} activeOpacity={0.7}>
        <IcoGrid on={active === 'dashboard'} />
        <Text style={[styles.lbl, active === 'dashboard' && styles.lblOn]}>Tableau</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('debts')} activeOpacity={0.7}>
        <IcoBook on={active === 'debts'} />
        <Text style={[styles.lbl, active === 'debts' && styles.lblOn]}>Dettes</Text>
      </TouchableOpacity>

      {/* FAB central — enregistrement vente rapide */}
      <TouchableOpacity style={styles.fab} onPress={() => press('sale')} activeOpacity={0.85}>
        <IcoPlus />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('orders')} activeOpacity={0.7}>
        <IcoMsg on={active === 'orders'} />
        <Text style={[styles.lbl, active === 'orders' && styles.lblOn]}>Commandes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('profile')} activeOpacity={0.7}>
        <IcoProfil on={active === 'profile'} />
        <Text style={[styles.lbl, active === 'profile' && styles.lblOn]}>Profil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MERCHANT_NAV_HEIGHT,
    backgroundColor: 'rgba(20,21,42,.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  lbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 9.5,
  },
  lblOn: { color: colors.accent },

  // FAB légèrement surélevé par-dessus la barre
  fab: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
});
