import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

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

const IcoMic = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={colors.bg} strokeWidth={2} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.bg} strokeWidth={2} />
    <Path d="M12 19v3" stroke={colors.bg} strokeWidth={2} />
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
  const press = (tab: NavTab) => onPress?.(tab);

  return (
    <View style={styles.bar}>
      {/* Accueil */}
      <TouchableOpacity style={styles.item} onPress={() => press('home')} activeOpacity={0.7}>
        <IcoHome on={active === 'home'} />
        <Text style={[styles.label, active === 'home' && styles.labelOn]}>Accueil</Text>
      </TouchableOpacity>

      {/* Favoris */}
      <TouchableOpacity style={styles.item} onPress={() => press('favorites')} activeOpacity={0.7}>
        <IcoStar on={active === 'favorites'} />
        <Text style={[styles.label, active === 'favorites' && styles.labelOn]}>Favoris</Text>
      </TouchableOpacity>

      {/* FAB micro central — légèrement relevé */}
      <TouchableOpacity style={styles.fab} onPress={() => press('voice')} activeOpacity={0.85}>
        <IcoMic />
      </TouchableOpacity>

      {/* Messages */}
      <TouchableOpacity style={styles.item} onPress={() => press('messages')} activeOpacity={0.7}>
        <IcoMsg on={active === 'messages'} />
        <Text style={[styles.label, active === 'messages' && styles.labelOn]}>Messages</Text>
      </TouchableOpacity>

      {/* Profil */}
      <TouchableOpacity style={styles.item} onPress={() => press('profile')} activeOpacity={0.7}>
        <IcoProfile on={active === 'profile'} />
        <Text style={[styles.label, active === 'profile' && styles.labelOn]}>Profil</Text>
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
  // FAB légèrement relevé au-dessus de la barre
  fab: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
});
