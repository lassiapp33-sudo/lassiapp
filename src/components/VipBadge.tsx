import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export default function VipBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={18} height={14} viewBox="0 4 24 18">
        {/* Base band */}
        <Path d="M2 19h20v2.5H2z" fill={colors.accent} />
        {/* Couronne 3 pics — pic central le plus haut */}
        <Path d="M3 19l3-11 3 6 3-9 3 9 3-6 3 11H3z" fill={colors.accent} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,207,52,.18)',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 5,
  },
});
