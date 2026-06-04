import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

export interface MonthBar6 {
  offset: number;
  short: string;
  total: number;
  confirmed: number;
}

interface Props {
  bar: MonthBar6;
  max: number;
  selected: boolean;
  onPress: () => void;
}

export function RevenueMonthBarItem({ bar, max, selected, onPress }: Props) {
  const H = 80;
  const pct = max > 0 ? bar.total / max : 0;
  const barH = Math.max(3, Math.round(pct * H));
  const confH = bar.total > 0 ? Math.round(barH * (bar.confirmed / bar.total)) : 0;

  return (
    <TouchableOpacity style={s.col} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.track, { height: H }]}>
        <View
          style={[
            s.fillBg,
            { height: barH },
            selected && { backgroundColor: 'rgba(253,207,52,.4)' },
          ]}
        >
          {confH > 0 && (
            <View
              style={[
                s.fillConf,
                { height: confH },
                selected && { backgroundColor: colors.accent },
              ]}
            />
          )}
        </View>
      </View>
      <Text style={[s.label, selected && s.labelSel]}>{bar.short}</Text>
      {selected && <View style={s.dot} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: { width: 30, justifyContent: 'flex-end' },
  fillBg: {
    width: 30,
    borderRadius: 7,
    backgroundColor: 'rgba(253,207,52,.15)',
    justifyContent: 'flex-end',
  },
  fillConf: { width: 30, borderRadius: 7, backgroundColor: 'rgba(253,207,52,.6)' },
  label: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  labelSel: { color: colors.accent, fontFamily: fonts.ui },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
});
