import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { IcoBack } from '../icons';

const IcoEye = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke={colors.accent} />
    <Circle cx={12} cy={12} r={3} stroke={colors.accent} />
  </Svg>
);

const IcoTag = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke={colors.bg} />
    <Path d="M7 7h.01" stroke={colors.bg} />
  </Svg>
);

interface Props {
  onBack:     () => void;
  onPreview:  () => void;
  onPromos?:  () => void;
}

export default function StoreHeader({ onBack, onPreview, onPromos }: Props) {
  return (
    <View style={[styles.row, { paddingTop: TOP_INSET + 4 }]}>
      <TouchableOpacity style={styles.btn} onPress={onBack} activeOpacity={0.8}>
        <IcoBack />
      </TouchableOpacity>

      <Text style={styles.title}>Ma vitrine</Text>

      {/* Promotions */}
      {onPromos && (
        <TouchableOpacity style={styles.promos} onPress={onPromos} activeOpacity={0.8}>
          <IcoTag />
          <Text style={styles.promosTxt}>Promos</Text>
        </TouchableOpacity>
      )}

      {/* Aperçu — voit la vitrine telle que le client la voit */}
      <TouchableOpacity style={styles.preview} onPress={onPreview} activeOpacity={0.8}>
        <IcoEye />
        <Text style={styles.previewTxt}>Aperçu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  btn: {
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
    flex: 1,
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },
  promos: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  promosTxt: {
    color:      colors.bg,
    fontFamily: fonts.title,
    fontSize:   11.5,
  },
  preview: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  previewTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 11.5,
  },
});
