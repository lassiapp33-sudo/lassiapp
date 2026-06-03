import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { DayRevenue } from '../../types/merchantPayments';
import { formatPrice } from '../../utils/format';

const BAR_MAX_H = 64;

function shortAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

interface Props { data: DayRevenue[]; }

export function PaymentWeekChart({ data }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}>Revenus — 7 derniers jours</Text>
        {selected !== null && data[selected].amount > 0 && (
          <Text style={s.tooltip}>
            {data[selected].label} · {formatPrice(data[selected].amount)}
          </Text>
        )}
      </View>
      <View style={s.bars}>
        {data.map((d, i) => {
          const barH   = d.amount > 0 ? Math.max((d.amount / maxAmount) * BAR_MAX_H, 6) : 3;
          const isSel  = selected === i;
          const isToday = i === data.length - 1;
          return (
            <TouchableOpacity
              key={d.date}
              style={s.barCol}
              onPress={() => setSelected(isSel ? null : i)}
              activeOpacity={0.75}
            >
              {d.amount > 0 && <Text style={s.barAmt}>{shortAmount(d.amount)}</Text>}
              <View style={[
                s.bar,
                { height: barH },
                isSel    && s.barSel,
                isToday  && s.barToday,
                d.amount === 0 && s.barZero,
              ]} />
              <Text style={[s.barLabel, isToday && s.barLabelToday]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 18, marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  title:   { color: colors.muted, fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  tooltip: { color: colors.accent, fontFamily: fonts.title, fontSize: 11 },
  bars:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_MAX_H + 28 },
  barCol:  { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barAmt:  { color: colors.muted, fontFamily: fonts.body, fontSize: 9 },
  bar:     { width: 22, borderRadius: 5, backgroundColor: colors.border },
  barSel:  { backgroundColor: colors.accent },
  barToday:{ backgroundColor: 'rgba(253,207,52,0.45)' },
  barZero: { backgroundColor: colors.border, opacity: 0.4 },
  barLabel:      { color: colors.muted,  fontFamily: fonts.body, fontSize: 10 },
  barLabelToday: { color: colors.accent },
});
