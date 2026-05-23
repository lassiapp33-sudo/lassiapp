import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { fonts } from '../../theme';
import { PayMethod } from '../../types/payment';

const WAVE_COLOR = '#1DC8F2';
const OM_COLOR   = '#FF7900';

const IcoInfo = ({ color }: { color: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={color} />
    <Path d="M12 16v-4" stroke={color} />
    <Path d="M12 8h.01" stroke={color} />
  </Svg>
);

interface Props { method: PayMethod; }

export default function DeepLinkNote({ method }: Props) {
  const isWave  = method === 'wave';
  const accent  = isWave ? WAVE_COLOR : OM_COLOR;
  const appName = isWave ? 'Wave' : 'Orange Money';
  const textColor = isWave ? '#9fd9e8' : '#f5c9a0';
  const bgColor   = isWave ? 'rgba(29,200,242,.07)' : 'rgba(255,121,0,.07)';
  const bdColor   = isWave ? 'rgba(29,200,242,.25)' : 'rgba(255,121,0,.25)';

  return (
    <View style={[styles.note, { backgroundColor: bgColor, borderColor: bdColor }]}>
      <View style={styles.icon}>
        <IcoInfo color={accent} />
      </View>
      <Text style={[styles.txt, { color: textColor }]}>
        {'Tu seras redirigé vers '}
        <Text style={styles.bold}>{appName}</Text>
        {' avec le montant déjà rempli. Valide avec ton code, puis reviens sur LASSİ. Aucune saisie manuelle.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    paddingHorizontal: 13,
    marginTop: 6,
  },
  icon: { marginTop: 1, flexShrink: 0 },
  txt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 18,
  },
  bold: {
    color: '#fff',
    fontFamily: fonts.ui,
  },
});
