import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

export default function VipBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}>
        <Path
          d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z"
          stroke={colors.accent}
          fill={colors.accent}
        />
      </Svg>
      <Text style={styles.txt}>VIP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(253,207,52,.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  txt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
});
