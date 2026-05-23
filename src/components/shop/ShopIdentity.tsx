import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoStar = () => (
  <Svg width={10} height={10} viewBox="0 0 24 24">
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" fill={colors.bg} />
  </Svg>
);

interface Props {
  initial: string;
  isVip:   boolean;
  isOpen:  boolean;
}

export default function ShopIdentity({ initial, isVip, isOpen }: Props) {
  return (
    // -42 : la moitié du logo (84px) chevauche la bannière du dessus
    <View style={styles.row}>
      <View style={styles.logo}>
        <Text style={styles.logoTxt}>{initial}</Text>
      </View>

      <View style={styles.meta}>
        <View style={styles.badges}>
          {isVip && (
            <View style={styles.badgeVip}>
              <IcoStar />
              <Text style={styles.badgeVipTxt}>TOP 3 VIP</Text>
            </View>
          )}
          <View style={[
            styles.badgeStatus,
            { backgroundColor: isOpen ? 'rgba(95,211,138,.15)' : 'rgba(224,122,122,.12)' },
          ]}>
            <Text style={[
              styles.badgeStatusTxt,
              { color: isOpen ? colors.success : colors.danger },
            ]}>
              {isOpen ? '● Ouvert' : '● Fermé'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    marginTop: -42,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
    flexShrink: 0,
  },
  logoTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 32,
  },
  meta: {
    flex: 1,
    paddingBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badgeVip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  badgeVipTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
  badgeStatus: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  badgeStatusTxt: {
    fontFamily: fonts.ui,
    fontSize: 9,
  },
});
