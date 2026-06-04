import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

const STAR_PATH =
  'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z';

interface StarProps {
  filled: boolean;
  size: number;
}

function Star({ filled, size }: StarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR_PATH}
        fill={filled ? colors.accent : 'none'}
        stroke={filled ? colors.accent : colors.muted}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  gap?: number;
}

export default function StarRating({ value, onChange, size = 28, gap = 6 }: Props) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={[styles.row, { gap }]}>
      {stars.map(n =>
        onChange ? (
          <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.7}>
            <Star filled={n <= value} size={size} />
          </TouchableOpacity>
        ) : (
          <Star key={n} filled={n <= value} size={size} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
