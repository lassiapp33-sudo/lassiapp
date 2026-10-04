import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { PayMethod } from '../../types/payment';

// Logos partenaires intégrés tels quels — ne pas modifier les images
const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO = require('../../../assets/om.png');

const WAVE_COLOR = '#1DC8F2';
const OM_COLOR = '#FF7900';

const CONFIG: Record<
  PayMethod,
  {
    label: string;
    desc: string;
    color: string;
    logo: ReturnType<typeof require>;
  }
> = {
  wave: {
    label: 'Wave',
    desc: 'Paiement instantané sécurisé',
    color: WAVE_COLOR,
    logo: WAVE_LOGO,
  },
  om: {
    label: 'Orange Money',
    desc: 'Paiement instantané sécurisé',
    color: OM_COLOR,
    logo: OM_LOGO,
  },
};

interface Props {
  method: PayMethod;
  selected: boolean;
  onSelect: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function PayMethodCard({ method, selected, onSelect, loading, disabled }: Props) {
  const cfg = CONFIG[method];

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSel, disabled && styles.cardDisabled]}
      onPress={onSelect}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {/* Logo partenaire — intégré tel quel */}
      <Image
        source={cfg.logo}
        style={[styles.logo, { borderColor: cfg.color }]}
        resizeMode="cover"
      />

      {/* Infos */}
      <View style={styles.info}>
        <Text style={styles.label}>{cfg.label}</Text>
        <Text style={styles.desc}>
          {loading && selected ? 'Connexion en cours…' : cfg.desc}
        </Text>
      </View>

      {/* Spinner si loading sur ce mode, sinon flèche */}
      {loading && selected ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <View style={[styles.arrow, selected && styles.arrowSel]}>
          <Text style={[styles.arrowTxt, selected && styles.arrowTxtSel]}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 11,
  },
  cardSel: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.06)',
  },

  // Logo intégré tel quel dans un carré arrondi
  logo: {
    width: 46,
    height: 46,
    borderRadius: 13,
    flexShrink: 0,
  },

  info: { flex: 1 },
  label: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  cardDisabled: { opacity: 0.45 },

  arrow: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  arrowSel: { borderColor: colors.accent, backgroundColor: colors.accent },
  arrowTxt: { color: colors.muted, fontSize: 18, lineHeight: 22, marginLeft: 1 },
  arrowTxtSel: { color: colors.bg },
});
