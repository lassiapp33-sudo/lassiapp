import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export interface VipEntry {
  rank:    1 | 2 | 3;
  initial: string;
  name:    string;
  zone:    string;
}

interface Props {
  entries:   VipEntry[];  // doit avoir exactement 3 entrées rang 1, 2, 3
  subLabel?: string;      // ex: "Tangana"
  renewIn?:  string;      // ex: "3j"
  onPress?:  (entry: VipEntry) => void;
}

// Couleurs des médailles
const MEDAL_BG: Record<number, string> = {
  1: colors.accent,
  2: '#C0C5D6',
  3: '#CD8B5E',
};

// Hauteurs des bases du podium
const BASE_H:  Record<1|2|3, number> = { 1: 46, 2: 34, 3: 26 };
const AV_SIZE: Record<1|2|3, number> = { 1: 74, 2: 60, 3: 60 };
const AV_FONT: Record<1|2|3, number> = { 1: 24, 2: 20, 3: 20 };

function PodColumn({ entry, onPress }: { entry: VipEntry; onPress?: () => void }) {
  const { rank, initial, name, zone } = entry;
  const avSize  = AV_SIZE[rank];
  const baseH   = BASE_H[rank];
  const isFirst = rank === 1;

  return (
    <TouchableOpacity style={styles.col} onPress={onPress} activeOpacity={0.8}>
      {/* Couronne au-dessus du 1er */}
      {isFirst && <Text style={styles.crown}>👑</Text>}

      {/* Avatar */}
      <View style={[
        styles.av,
        { width: avSize, height: avSize },
        isFirst && styles.av1,
      ]}>
        <Text style={[styles.avTxt, { fontSize: AV_FONT[rank] }]}>{initial}</Text>

        {/* Médaille */}
        <View style={[
          styles.medal,
          { backgroundColor: MEDAL_BG[rank], left: avSize / 2 - 12 },
        ]}>
          <Text style={styles.medalTxt}>{rank}</Text>
        </View>
      </View>

      {/* Nom + quartier */}
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.zone}>{zone}</Text>

      {/* Socle du podium */}
      <View style={[
        styles.base,
        { height: baseH },
        isFirst && styles.base1,
      ]}>
        <Text style={[styles.baseNum, isFirst && styles.baseNum1]}>{rank}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function VipPodium({ entries, subLabel = '', renewIn = '3j', onPress }: Props) {
  const sorted = [
    entries.find(e => e.rank === 2)!,
    entries.find(e => e.rank === 1)!,
    entries.find(e => e.rank === 3)!,
  ];

  return (
    <View style={styles.section}>
      {/* En-tête */}
      <View style={styles.head}>
        <Text style={styles.crown}>🏆</Text>
        <Text style={styles.headTitle}>Top 3 de la semaine</Text>
      </View>
      <View style={styles.subRow}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
          <Circle cx={12} cy={12} r={10} stroke={colors.muted} />
          <Path d="M12 6v6l4 2" stroke={colors.muted} />
        </Svg>
        <Text style={styles.subTxt}>
          Champions {subLabel} de tout Dakar ·{' '}
          <Text style={styles.subAccent}>renouvelé dans {renewIn}</Text>
        </Text>
      </View>

      {/* Podium — ordre : 2e, 1er, 3e */}
      <View style={styles.podium}>
        {sorted.map(entry => (
          <PodColumn
            key={entry.rank}
            entry={entry}
            onPress={() => onPress?.(entry)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: 'rgba(253, 207, 52, 0.05)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  crown: { fontSize: 17 },
  headTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 20,
  },
  subTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    flex: 1,
  },
  subAccent: {
    color: colors.accent,
    fontFamily: fonts.ui,
  },

  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },

  col: {
    width: 88,
    alignItems: 'center',
  },

  av: {
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  av1: { borderColor: colors.accent },
  avTxt: {
    color: colors.white,
    fontFamily: fonts.title,
  },

  medal: {
    position: 'absolute',
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  medalTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 11,
  },

  name: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 10,
    maxWidth: 84,
  },
  zone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },

  base: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    width: '100%',
    alignItems: 'center',
    paddingTop: 7,
  },
  base1: {
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    borderColor: colors.accent,
  },
  baseNum: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  baseNum1: { color: colors.accent },
});
