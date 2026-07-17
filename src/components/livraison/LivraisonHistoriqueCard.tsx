import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Livraison } from '../../services/livraisons';
import { formatPrice, formatDateLong } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoTruck = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 3h15v13H1z" stroke={colors.accent} />
    <Path d="M16 8h4l3 3v5h-7V8z" stroke={colors.accent} />
    <Circle cx={5.5} cy={18.5} r={2.5} stroke={colors.accent} />
    <Circle cx={18.5} cy={18.5} r={2.5} stroke={colors.accent} />
  </Svg>
);

// ─── Config statuts ───────────────────────────────────────────────────────────

const STATUT_CFG: Record<Livraison['statut'], { label: string; dot: string; text: string; bg: string }> = {
  en_attente: { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)' },
  acceptee:   { label: 'En cours',   dot: '#5B9EF7', text: '#5B9EF7', bg: 'rgba(91,158,247,0.12)' },
  terminee:   { label: 'Livrée',     dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)' },
  annulee:    { label: 'Annulée',    dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  livraison: Livraison;
}

export const LivraisonHistoriqueCard = React.memo(function LivraisonHistoriqueCard({ livraison }: Props) {
  const cfg = STATUT_CFG[livraison.statut];

  return (
    <View style={s.wrap}>
      {/* En-tête : chip type + badge statut */}
      <View style={s.top}>
        <View style={s.typeChip}>
          <IcoTruck />
          <Text style={s.typeLabel}>Livraison</Text>
        </View>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <View style={[s.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[s.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Trajet */}
      <View style={s.trajet}>
        <Text style={s.trajetLabel} numberOfLines={1}>{livraison.depart_label}</Text>
        <Text style={s.arrow}>→</Text>
        <Text style={s.trajetLabel} numberOfLines={1}>{livraison.arrivee_label}</Text>
      </View>

      <View style={s.divider} />

      {/* Pied : prix + km + date */}
      <View style={s.footer}>
        <Text style={s.prix}>{formatPrice(livraison.prix_livraison)}</Text>
        <Text style={s.meta}>{Number(livraison.distance_km).toFixed(1)} km</Text>
        <Text style={s.meta}>{formatDateLong(livraison.created_at)}</Text>
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(253,207,52,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,0.25)',
  },
  typeLabel: { color: colors.accent, fontFamily: fonts.label, fontSize: 11 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 11 },

  trajet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  trajetLabel: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  arrow: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    flexShrink: 0,
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 14, flex: 1 },
  meta: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
});
