import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { useT } from '../../i18n';
import { LassiMascotte } from '../LassiMascotte';

export type NavTab = 'home' | 'favorites' | 'voice' | 'messages' | 'profile';

interface Props {
  active:   NavTab;
  onPress?: (tab: NavTab) => void;
}

const BOTTOM_EXTRA = Platform.OS === 'ios' ? 20 : 0;
export const NAV_HEIGHT = 72 + BOTTOM_EXTRA;

// Icônes nav
const IcoHome = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={on ? colors.accent : colors.muted} />
    <Path d="M9 22V12h6v10" stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoStar = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={on ? colors.accent : colors.muted} />
  </Svg>
);


const IcoMsg = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

const IcoProfile = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4} stroke={on ? colors.accent : colors.muted} />
    <Path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" stroke={on ? colors.accent : colors.muted} />
  </Svg>
);

export default function BottomNav({ active, onPress }: Props) {
  const t     = useT();
  const press = (tab: NavTab) => onPress?.(tab);

  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.item} onPress={() => press('home')} activeOpacity={0.7}>
        <IcoHome on={active === 'home'} />
        <Text style={[styles.label, active === 'home' && styles.labelOn]}>{t.nav.home}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('favorites')} activeOpacity={0.7}>
        <IcoStar on={active === 'favorites'} />
        <Text style={[styles.label, active === 'favorites' && styles.labelOn]}>{t.nav.favorites}</Text>
      </TouchableOpacity>

      <LassiMascotte
        forme="support"
        taille={52}
        animation="beat"
        glow
        style={styles.fabSlot}
        onPress={() => press('voice')}
      />

      <TouchableOpacity style={styles.item} onPress={() => press('messages')} activeOpacity={0.7}>
        <IcoMsg on={active === 'messages'} />
        <Text style={[styles.label, active === 'messages' && styles.labelOn]}>{t.nav.messages}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => press('profile')} activeOpacity={0.7}>
        <IcoProfile on={active === 'profile'} />
        <Text style={[styles.label, active === 'profile' && styles.labelOn]}>{t.nav.profile}</Text>
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
    height: NAV_HEIGHT,
    backgroundColor: 'rgba(20, 21, 42, 0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: BOTTOM_EXTRA + 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 9.5,
  },
  labelOn: { color: colors.accent },
  // Slot central — la mascotte dépasse légèrement au-dessus de la barre
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
});
