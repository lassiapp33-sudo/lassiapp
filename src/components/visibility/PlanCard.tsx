import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

export interface Plan {
  id:        string;
  label:     string;   // "3 mois"
  desc:      string;   // "Économise 6 000 F" / success color
  price:     number;
  perLabel:  string;   // "8 000 F/mois"
  oldPrice?: number;
  popular?:  boolean;
}

interface Props {
  plan:       Plan;
  selected:   boolean;
  onSelect:   () => void;
}

export default function PlanCard({ plan, selected, onSelect }: Props) {
  const pop = plan.popular ?? false;

  return (
    <TouchableOpacity
      style={[styles.card, pop && styles.cardPop, selected && !pop && styles.cardSel]}
      onPress={onSelect}
      activeOpacity={0.82}
    >
      {/* Badge "POPULAIRE" */}
      {pop && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>⭐ POPULAIRE</Text>
        </View>
      )}

      <View style={styles.row}>
        {/* Radio */}
        <View style={[styles.radio, (pop || selected) && styles.radioSel]}>
          {(pop || selected) && <View style={styles.radioDot} />}
        </View>

        {/* Durée + description */}
        <View style={styles.dur}>
          <Text style={styles.durLabel}>{plan.label}</Text>
          <Text style={styles.durDesc}>{plan.desc}</Text>
        </View>

        {/* Prix */}
        <View style={styles.priceBlock}>
          {plan.oldPrice != null && (
            <Text style={styles.oldPrice}>
              {plan.oldPrice.toLocaleString('fr-FR')} F
            </Text>
          )}
          <Text style={styles.price}>
            {plan.price.toLocaleString('fr-FR')} F
          </Text>
          <Text style={styles.perLabel}>{plan.perLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    position: 'relative',
  },
  cardPop: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.05)',
  },
  // Sélectionné (non populaire)
  cardSel: {
    borderColor: colors.accent,
  },

  // Badge flottant "POPULAIRE"
  badge: {
    position: 'absolute',
    top: -9,
    right: 18,
    backgroundColor: colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 9,
    letterSpacing: 0.3,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  // Bouton radio
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSel: { borderColor: colors.accent },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },

  dur: { flex: 1 },
  durLabel: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  durDesc: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  priceBlock: { alignItems: 'flex-end' },
  oldPrice: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 19,
  },
  perLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
});
