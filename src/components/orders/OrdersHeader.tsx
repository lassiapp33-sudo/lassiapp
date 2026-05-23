import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';

const IcoBack = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

interface Props {
  newCount: number;
  onBack:   () => void;
}

export default function OrdersHeader({ newCount, onBack }: Props) {
  const plural = newCount > 1;

  return (
    <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
        <IcoBack />
      </TouchableOpacity>

      <View>
        <Text style={styles.title}>Commandes</Text>
        {newCount > 0 ? (
          <Text style={styles.sub}>
            {'Tu as '}
            <Text style={styles.accent}>
              {newCount} nouvelle{plural ? 's' : ''} commande{plural ? 's' : ''}
            </Text>
            {' à valider'}
          </Text>
        ) : (
          <Text style={styles.sub}>Tout est à jour ✓</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 21,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
  },
  accent: {
    color: colors.accent,
    fontFamily: fonts.title,
  },
});
