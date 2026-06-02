import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import Avatar from '../Avatar';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VipEntry {
  rank:          1 | 2 | 3;
  /** ID de la boutique pour la navigation — vide si placeholder. */
  id:            string;
  initial:       string;
  name:          string;
  zone:          string;
  rating:        number;
  logoUrl?:      string | null;
  /** true = emplacement non encore occupé, affiché grisé avec lettre A/B/C. */
  isPlaceholder: boolean;
}

interface Props {
  /** 0 à 3 entrées VIP réelles — les positions manquantes deviennent des placeholders. */
  entries:   VipEntry[];
  subLabel?: string;   // ex: "Tangana"
  renewIn?:  string;   // ex: "7j"
  onPress?:  (entry: VipEntry) => void;
}

// ─── Constantes visuelles ────────────────────────────────────────────────────

const MEDAL_BG: Record<number, string> = {
  1: colors.accent,
  2: '#C0C5D6',
  3: '#CD8B5E',
};
const PLACEHOLDER_LABEL = ['A', 'B', 'C'];
const BASE_H:  Record<1|2|3, number> = { 1: 46, 2: 34, 3: 26 };
const AV_SIZE: Record<1|2|3, number> = { 1: 74, 2: 60, 3: 60 };
const AV_FONT: Record<1|2|3, number> = { 1: 24, 2: 20, 3: 20 };

// ─── Colonne du podium ───────────────────────────────────────────────────────

function PodColumn({ entry, onPress }: { entry: VipEntry; onPress?: () => void }) {
  const { rank, name, zone, rating, logoUrl, isPlaceholder } = entry;
  const avSize  = AV_SIZE[rank];
  const baseH   = BASE_H[rank];
  const isFirst = rank === 1;

  return (
    <TouchableOpacity
      style={styles.col}
      onPress={isPlaceholder ? undefined : onPress}
      activeOpacity={isPlaceholder ? 1 : 0.8}
    >
      {/* Couronne au-dessus du 1er uniquement si VIP réel */}
      {isFirst && !isPlaceholder ? (
        <Text style={styles.crown}>👑</Text>
      ) : isFirst ? (
        <View style={{ height: 22 }} />
      ) : null}

      {/* Avatar ou cercle grisé pour placeholder */}
      {isPlaceholder ? (
        <View style={[styles.phCircle, { width: avSize, height: avSize, borderRadius: avSize / 2 }]}>
          <Text style={[styles.phLetter, { fontSize: AV_FONT[rank] }]}>
            {PLACEHOLDER_LABEL[rank - 1]}
          </Text>
          {/* Médaille grisée */}
          <View style={[styles.medal, { backgroundColor: colors.surface, left: avSize / 2 - 12 }]}>
            <Text style={[styles.medalTxt, { color: colors.muted }]}>{rank}</Text>
          </View>
        </View>
      ) : (
        /* Conteneur pour Avatar + médaille positionnée en absolu */
        <View style={{ position: 'relative', marginBottom: 4 }}>
          <Avatar
            imageUrl={logoUrl}
            name={name}
            size={avSize}
            variant="shop"
            showBorder={isFirst}
          />
          <View style={[styles.medal, { backgroundColor: MEDAL_BG[rank], left: avSize / 2 - 12 }]}>
            <Text style={styles.medalTxt}>{rank}</Text>
          </View>
        </View>
      )}

      {/* Nom */}
      <Text
        style={[styles.name, isPlaceholder && styles.namePh]}
        numberOfLines={2}
      >
        {isPlaceholder ? 'Place disponible' : name}
      </Text>

      {/* Zone ou accroche placeholder */}
      <Text style={styles.zone}>
        {isPlaceholder ? 'Sois actif pour grimper ici' : zone}
      </Text>

      {/* Note — seulement pour les vrais VIP avec rating > 0 */}
      {!isPlaceholder && rating > 0 && (
        <Text style={styles.rating}>⭐ {rating.toFixed(1)}</Text>
      )}

      {/* Socle du podium */}
      <View style={[
        styles.base,
        { height: baseH },
        isFirst && !isPlaceholder && styles.base1,
        isPlaceholder && styles.basePh,
      ]}>
        <Text style={[
          styles.baseNum,
          isFirst && !isPlaceholder && styles.baseNum1,
          isPlaceholder && styles.baseNumPh,
        ]}>
          {rank}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Complétion automatique jusqu'à 3 colonnes ───────────────────────────────

function buildPodium(entries: VipEntry[]): VipEntry[] {
  return ([1, 2, 3] as const).map(rank => {
    const found = entries.find(e => e.rank === rank && !e.isPlaceholder);
    if (found) return found;
    return {
      rank,
      id:            '',
      initial:       PLACEHOLDER_LABEL[rank - 1],
      name:          'Place disponible',
      zone:          '',
      rating:        0,
      logoUrl:       null,
      isPlaceholder: true,
    };
  });
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function VipPodium({ entries, subLabel = '', renewIn = '7j', onPress }: Props) {
  const hasReal = entries.some(e => !e.isPlaceholder);
  const podium  = buildPodium(entries);

  // Ordre d'affichage : 2e à gauche, 1er au centre, 3e à droite
  const sorted = [
    podium.find(e => e.rank === 2)!,
    podium.find(e => e.rank === 1)!,
    podium.find(e => e.rank === 3)!,
  ];

  return (
    <View style={styles.section}>
      {/* En-tête */}
      <View style={styles.head}>
        <Text style={styles.headIcon}>🏆</Text>
        <Text style={styles.headTitle}>Top 3 {subLabel}</Text>
      </View>

      <View style={styles.subRow}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
          <Circle cx={12} cy={12} r={10} stroke={colors.muted} />
          <Path d="M12 6v6l4 2" stroke={colors.muted} />
        </Svg>
        {hasReal ? (
          <Text style={styles.subTxt}>
            Champions {subLabel} de tout Dakar ·{' '}
            <Text style={styles.subAccent}>renouvelé dans {renewIn}</Text>
          </Text>
        ) : (
          <Text style={styles.subTxt}>
            Le Top 3 se révèle avec l'activité ·{' '}
            <Text style={styles.subAccent}>renouvelé chaque semaine</Text>
          </Text>
        )}
      </View>

      {/* Podium */}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  headIcon: { fontSize: 17 },
  crown:    { fontSize: 17 },
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

  // Cercle placeholder grisé
  phCircle: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  phLetter: {
    color: colors.muted,
    fontFamily: fonts.title,
    opacity: 0.5,
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
  namePh: {
    color: colors.muted,
    opacity: 0.6,
    fontFamily: fonts.body,
  },

  zone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 9.5,
    marginTop: 2,
    marginBottom: 4,
    textAlign: 'center',
  },

  rating: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 10,
    marginBottom: 4,
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
  basePh: {
    opacity: 0.35,
  },
  baseNum: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  baseNum1: { color: colors.accent },
  baseNumPh: { color: colors.border },
});
