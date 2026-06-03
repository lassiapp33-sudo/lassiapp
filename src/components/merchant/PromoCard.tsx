import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Promotion, getPromoStatus } from '../../types/promotions';
import { StoreProduct } from '../../types/store';
import { formatPrice, formatDateDMY } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

export const IcoTag = ({ stroke }: { stroke: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke={stroke} />
    <Path d="M7 7h.01" stroke={stroke} />
  </Svg>
);

const IcoEdit = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="#E07A7A" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PromoCardProps {
  promo:    Promotion;
  products: StoreProduct[];
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function PromoCard({ promo, products, onEdit, onDelete, onToggle }: PromoCardProps) {
  const status  = getPromoStatus(promo);
  const product = promo.cibleType === 'produit' && promo.cibleId
    ? products.find(p => p.id === promo.cibleId)
    : null;

  const cibleLabel =
    promo.cibleType === 'vitrine'   ? 'Toute la vitrine' :
    promo.cibleType === 'categorie' ? `Catégorie : ${promo.cibleId ?? '—'}` :
    product ? `Produit : ${product.name}` : '—';

  const valeurLabel =
    promo.type === 'pourcentage'      ? `−${promo.valeur}%` :
    promo.type === 'montant_fixe'     ? `−${formatPrice(promo.valeur)}` :
    promo.type === 'quantite_offerte' ? `${promo.valeur}+1 offert` :
    `→ ${formatPrice(promo.valeur)}`;

  return (
    <View style={s.card}>
      <View style={s.top}>
        <View style={s.iconWrap}>
          <IcoTag stroke={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{promo.titre}</Text>
          <Text style={s.sub}>{valeurLabel} · {cibleLabel}</Text>
        </View>
        <Switch
          value={promo.actif}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: `${colors.accent}55` }}
          thumbColor={promo.actif ? colors.accent : '#555'}
        />
      </View>

      <View style={s.bot}>
        <View style={[s.statusBadge, { backgroundColor: `${status.color}22` }]}>
          <View style={[s.statusDot, { backgroundColor: status.color }]} />
          <Text style={[s.statusTxt, { color: status.color }]}>{status.label}</Text>
        </View>
        {promo.dateFin && (
          <Text style={s.date}>Jusqu'au {formatDateDMY(promo.dateFin)}</Text>
        )}
        {promo.montantMin > 0 && (
          <Text style={s.date}>Min. {formatPrice(promo.montantMin)}</Text>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.iconBtn} onPress={onEdit} activeOpacity={0.7}>
          <IcoEdit />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onDelete} activeOpacity={0.7}>
          <IcoTrash />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden',
  },
  top:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.accent}18`, alignItems: 'center', justifyContent: 'center' },
  title:   { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  sub:     { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  bot:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontFamily: fonts.ui, fontSize: 10.5 },
  date:    { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.05)', alignItems: 'center', justifyContent: 'center' },
});
