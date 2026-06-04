import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { useT } from '../../i18n';

export type FilterId = 'near' | 'top' | 'open';

interface Filter {
  id: FilterId;
  icon: (active: boolean) => React.ReactNode;
}

const c = (on: boolean) => (on ? colors.accent : colors.muted);

const FILTER_DEFS: Filter[] = [
  {
    id: 'near',
    icon: on => (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
        <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={c(on)} />
        <Circle cx={12} cy={10} r={3} stroke={c(on)} />
      </Svg>
    ),
  },
  {
    id: 'top',
    icon: on => (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
        <Path
          d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z"
          stroke={c(on)}
          fill={on ? colors.accent : 'none'}
        />
      </Svg>
    ),
  },
  {
    id: 'open',
    icon: on => (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
        <Circle cx={12} cy={12} r={10} stroke={c(on)} />
        <Path d="M12 6v6l4 2" stroke={c(on)} />
      </Svg>
    ),
  },
];

interface Props {
  active: FilterId;
  onChange: (id: FilterId) => void;
}

export default function FilterBar({ active, onChange }: Props) {
  const t = useT();
  const labels: Record<FilterId, string> = {
    near: t.category.nearFilter,
    top: t.category.topFilter,
    open: t.category.openFilter,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.list}
    >
      {FILTER_DEFS.map(f => {
        const on = f.id === active;
        return (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(f.id)}
            activeOpacity={0.8}
          >
            {f.icon(on)}
            <Text style={[styles.label, on && styles.labelOn]}>{labels[f.id]}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 62 },
  list: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    borderColor: colors.accent,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  labelOn: { color: colors.accent },
});
