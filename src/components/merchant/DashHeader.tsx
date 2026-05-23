import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoBell = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={colors.white} />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={colors.white} />
  </Svg>
);

interface Props {
  name:          string;
  isVip?:        boolean;
  notifCount?:   number;
  onNotifPress?: () => void;
}

export default function DashHeader({ name, isVip, notifCount = 0, onNotifPress }: Props) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.greeting}>Asalaa maalekum 👋</Text>
        <Text style={styles.name}>
          {name}{isVip ? <Text style={styles.vip}> 🏆</Text> : null}
        </Text>
      </View>

      {/* Cloche de notification */}
      <TouchableOpacity style={styles.bell} onPress={onNotifPress} activeOpacity={0.8}>
        {notifCount > 0 && <View style={styles.dot} />}
        <IcoBell />
      </TouchableOpacity>
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
  dot: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    zIndex: 1,
  },
});
