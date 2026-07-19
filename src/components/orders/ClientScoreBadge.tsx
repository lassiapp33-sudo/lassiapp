import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

const STAR_PATH =
  'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z';

function scoreColor(score: number): string {
  if (score >= 4) return colors.success;
  if (score >= 3) return colors.orange;
  return colors.danger;
}

interface Props {
  score: number;
  nbNotes: number;
}

export default function ClientScoreBadge({ score, nbNotes }: Props) {
  if (nbNotes === 0) return null;

  const color = scoreColor(score);

  return (
    <View style={styles.row}>
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d={STAR_PATH} fill={color} stroke={color} strokeWidth={1} />
      </Svg>
      <Text style={[styles.score, { color }]}>{score.toFixed(1)}</Text>
      <Text style={styles.count}>· {nbNotes} note{nbNotes > 1 ? 's' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  score: {
    fontFamily: fonts.title,
    fontSize: 10.5,
  },
  count: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
});
