import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';

const IcoBell = () => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={colors.white} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={colors.white} />
  </Svg>
);

const IcoPin = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Circle cx={12} cy={10} r={3} stroke={colors.accent} />
  </Svg>
);

interface Props {
  name: string;
  isVip?: boolean;
  notifCount?: number;
  zoneName?: string;
  /** Solde de crédit LASSI dépensable — toujours affiché, "0 F" si vide. */
  creditBalance?: number;
  onNotifPress?: () => void;
  onLocation?: () => void;
}

export default function DashHeader({
  name,
  isVip,
  notifCount = 0,
  zoneName,
  creditBalance = 0,
  onNotifPress,
  onLocation,
}: Props) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.greeting}>Asalaa maalekum 👋</Text>
        <Text style={styles.name}>
          {name}
          {isVip ? <Text style={styles.vip}> 🏆</Text> : null}
        </Text>
        {/* Zone géographique réelle sous le nom */}
        {zoneName ? (
          <TouchableOpacity style={styles.locRow} onPress={onLocation} activeOpacity={0.7}>
            <IcoPin />
            <Text style={styles.locTxt}>{zoneName}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.rightCol}>
        {/* Solde de crédit LASSI */}
        <View style={styles.creditPill}>
          <Text style={styles.creditTxt}>Crédit : {formatPrice(creditBalance)}</Text>
        </View>

        {/* Cloche de notification */}
        <TouchableOpacity style={styles.bell} onPress={onNotifPress} activeOpacity={0.8}>
          {notifCount > 0 && (
            <View style={[styles.badge, notifCount > 9 && styles.badgeWide]}>
              <Text style={styles.badgeTxt}>{notifCount > 99 ? '99+' : notifCount}</Text>
            </View>
          )}
          <IcoBell />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    marginTop: 2,
  },
  vip: {
    fontSize: 13,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  creditPill: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  creditTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 1,
  },
  badgeWide: {
    paddingHorizontal: 5,
    borderRadius: 9,
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontWeight: '700',
    lineHeight: 13,
  },
});
