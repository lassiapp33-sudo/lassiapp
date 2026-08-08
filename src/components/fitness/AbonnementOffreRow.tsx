import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { FitnessOffre } from '../../services/fitnessAbonnements';
import { formatPrice } from '../../utils/format';

const IcoPencil = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.accent} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.accent} />
  </Svg>
);

interface Props {
  offre: FitnessOffre;
  onEdit: () => void;
  onToggleActif: () => void;
}

export default function AbonnementOffreRow({ offre, onEdit, onToggleActif }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.nom} numberOfLines={1}>{offre.nom}</Text>
        {offre.description ? (
          <Text style={styles.desc} numberOfLines={2}>{offre.description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.duree}>⏱ {offre.dureeJours} jours</Text>
          <Text style={styles.prix}>{formatPrice(offre.prix)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.badge, offre.actif ? styles.badgeOn : styles.badgeOff]}
          onPress={onToggleActif}
          activeOpacity={0.75}
          hitSlop={6}
        >
          <Text style={[styles.badgeTxt, offre.actif ? styles.badgeTxtOn : styles.badgeTxtOff]}>
            {offre.actif ? 'ACTIF' : 'INACTIF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <IcoPencil />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: { flex: 1, minWidth: 0 },
  nom: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  duree: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  prix: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  badgeOn: { backgroundColor: 'rgba(95,211,138,.13)' },
  badgeOff: { backgroundColor: 'rgba(224,122,122,.13)' },
  badgeTxt: { fontFamily: fonts.titleXL, fontSize: 9 },
  badgeTxtOn:  { color: colors.success },
  badgeTxtOff: { color: colors.danger },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(253,207,52,.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
