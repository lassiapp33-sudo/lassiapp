import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { useT } from '../../i18n';
import { LassiMascotte } from '../LassiMascotte';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoGrid = ({ on }: { on: boolean }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoMsg = ({ on }: { on: boolean }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={on ? colors.accent : colors.muted}
    />
  </Svg>
);

const IcoOrders = ({ on }: { on: boolean }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M9 11l3 3L22 4" stroke={on ? colors.accent : colors.muted} />
    <Path
      d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      stroke={on ? colors.accent : colors.muted}
    />
  </Svg>
);

const IcoProfil = ({ on }: { on: boolean }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={8} r={4} stroke={on ? colors.accent : colors.muted} />
    <Path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MerchantTab = 'dashboard' | 'debts' | 'assistant' | 'messages' | 'orders' | 'profile';

const BOTTOM_EXTRA = Platform.OS === 'ios' ? 20 : 0;
export const MERCHANT_NAV_HEIGHT = 72 + BOTTOM_EXTRA;

const MASCOTTE_TAILLE = 62;

interface Props {
  active: MerchantTab;
  onPress?: (tab: MerchantTab) => void;
  unreadMsg?: number;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MerchantBottomNav({ active, onPress, unreadMsg = 0 }: Props) {
  const t = useT();
  const press = (tab: MerchantTab) => onPress?.(tab);

  return (
    <View style={[styles.bar, { paddingBottom: BOTTOM_EXTRA + 8 }]}>
      <TouchableOpacity style={styles.item} onPress={() => press('dashboard')} activeOpacity={0.7}>
        <IcoGrid on={active === 'dashboard'} />
        <Text style={[styles.lbl, active === 'dashboard' && styles.lblOn]}>{t.nav.dashboard}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('orders')} activeOpacity={0.7}>
        <IcoOrders on={active === 'orders'} />
        <Text style={[styles.lbl, active === 'orders' && styles.lblOn]}>{t.nav.orders}</Text>
      </TouchableOpacity>

      {/* ── Mascotte Lassi — bouton central élevé ── */}
      <TouchableOpacity
        style={styles.mascotteBtn}
        onPress={() => press('assistant')}
        activeOpacity={0.82}
      >
        <LassiMascotte
          forme="support"
          taille={MASCOTTE_TAILLE}
          animation="beat"
          glow={active === 'assistant'}
          boucle
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('messages')} activeOpacity={0.7}>
        <View>
          <IcoMsg on={active === 'messages'} />
          {unreadMsg > 0 && (
            <View style={styles.dot}>
              <Text style={styles.dotTxt}>{unreadMsg > 9 ? '9+' : unreadMsg}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.lbl, active === 'messages' && styles.lblOn]}>{t.nav.messages}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('profile')} activeOpacity={0.7}>
        <IcoProfil on={active === 'profile'} />
        <Text style={[styles.lbl, active === 'profile' && styles.lblOn]}>{t.nav.profile}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Bouton mascotte central — surélévé au-dessus de la barre
  mascotteBtn: {
    alignItems: 'center',
    marginTop: -(MASCOTTE_TAILLE * 1.27 * 0.55), // dépasse au-dessus de la barre
    width: MASCOTTE_TAILLE + 8,
  },

  lassiLbl: {
    marginTop: -4,
  },

  lbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 9.5,
  },
  lblOn: { color: colors.accent },

  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dotTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 8.5,
  },
});
