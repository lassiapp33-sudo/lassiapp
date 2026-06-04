import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import Avatar from '../Avatar';

const IcoStar = () => (
  <Svg width={10} height={10} viewBox="0 0 24 24">
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" fill={colors.bg} />
  </Svg>
);

interface Props {
  initial: string;
  logoUrl?: string;
  isVip: boolean;
  isOpen: boolean;
}

export default function ShopIdentity({ initial, logoUrl, isVip, isOpen }: Props) {
  return (
    // -42 : la moitié du logo (84px) chevauche la bannière du dessus
    <View style={styles.row}>
      {/* Logo boutique avec bordure bg pour l'effet flottant sur la bannière */}
      <Avatar imageUrl={logoUrl} name={initial} size={84} variant="shop" showBorder />

      <View style={styles.meta}>
        <View style={styles.badges}>
          {isVip && (
            <View style={styles.badgeVip}>
              <IcoStar />
              <Text style={styles.badgeVipTxt}>TOP 3 VIP</Text>
            </View>
          )}
          <View
            style={[
              styles.badgeStatus,
              { backgroundColor: isOpen ? 'rgba(95,211,138,.15)' : 'rgba(224,122,122,.12)' },
            ]}
          >
            <Text
              style={[styles.badgeStatusTxt, { color: isOpen ? colors.success : colors.danger }]}
            >
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
