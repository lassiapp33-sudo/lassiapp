import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import Avatar from '../Avatar';
import { ClassementEntry } from '../../services/classementService';

const ARGENT = '#C0C0C0';
const BRONZE = '#CD7F32';

interface Props {
  top3: ClassementEntry[];
  /** 'shop' pour les podiums prestataires (logo boutique), 'user' pour les clients. */
  variant?: 'user' | 'shop';
}

export default function PodiumClassement({ top3, variant = 'shop' }: Props) {
  const [first, second, third] = top3;
  return (
    <View style={styles.podium}>
      {/* 2e */}
      <PodiumPlace entry={second} place={2} height={90} color={ARGENT} variant={variant} />
      {/* 1er */}
      <PodiumPlace
        entry={first}
        place={1}
        height={120}
        color={colors.accent}
        variant={variant}
        crown
      />
      {/* 3e */}
      <PodiumPlace entry={third} place={3} height={70} color={BRONZE} variant={variant} />
    </View>
  );
}

interface PodiumPlaceProps {
  entry?: ClassementEntry;
  place: 1 | 2 | 3;
  height: number;
  color: string;
  variant: 'user' | 'shop';
  crown?: boolean;
}

function PodiumPlace({ entry, place, height, color, variant, crown }: PodiumPlaceProps) {
  if (!entry) return <View style={{ flex: 1 }} />;
  return (
    <View style={styles.place}>
      {crown && <Text style={styles.crown}>👑</Text>}
      <Avatar
        imageUrl={entry.image_url}
        name={entry.nom_affiche}
        size={56}
        variant={variant}
        showBorder
        style={{ borderColor: color }}
      />
      <Text style={styles.nom} numberOfLines={1}>
        {entry.nom_affiche}
      </Text>
      <Text style={[styles.pts, { color }]}>{entry.points} pts</Text>
      <View style={[styles.bar, { height, backgroundColor: color }]}>
        <Text style={styles.barNum}>{place}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  place: { flex: 1, alignItems: 'center' },
  crown: { fontSize: 24, marginBottom: 2 },
  nom: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.ui,
    maxWidth: 90,
    textAlign: 'center',
    marginTop: 6,
  },
  pts: { fontSize: 12, fontFamily: fonts.title, marginBottom: 6 },
  bar: {
    width: '80%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  barNum: { color: colors.bg, fontFamily: fonts.title, fontSize: 20 },
});
