import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type PaymentStatut =
  | 'pending'
  | 'initiated'
  | 'confirmed'
  | 'split_done'
  | 'failed'
  | 'refunded'
  | 'simulated';

interface Config {
  label: string;
  icon: string;
  bg: string;
  color: string;
}

const STATUS_CONFIG: Record<PaymentStatut, Config> = {
  pending:    { label: 'En attente',   icon: '⏳', bg: '#2A2C52', color: '#9A9EC4' },
  initiated:  { label: 'En cours…',   icon: '🔄', bg: '#1A2E4A', color: '#5BB8F5' },
  confirmed:  { label: 'Confirmé',    icon: '✅', bg: '#1A3A2A', color: '#4DC78A' },
  split_done: { label: 'Payé',        icon: '💰', bg: '#2A2200', color: '#FDCF34' },
  failed:     { label: 'Échoué',      icon: '❌', bg: '#3A1A1A', color: '#F5655B' },
  refunded:   { label: 'Remboursé',   icon: '↩️', bg: '#2A1E10', color: '#F5A55B' },
  simulated:  { label: 'Simulé',      icon: '🔶', bg: '#251A38', color: '#B07BF5' },
};

interface Props {
  statut: PaymentStatut | string;
  size?: 'sm' | 'md';
}

export default function PaymentStatusBadge({ statut, size = 'md' }: Props) {
  const cfg: Config = STATUS_CONFIG[statut as PaymentStatut] ?? {
    label: statut,
    icon: '❓',
    bg: '#2A2C52',
    color: '#9A9EC4',
  };

  const isSm = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isSm && styles.badgeSm]}>
      <Text style={isSm ? styles.iconSm : styles.icon}>{cfg.icon}</Text>
      <Text style={[styles.label, { color: cfg.color }, isSm && styles.labelSm]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  icon: { fontSize: 14 },
  iconSm: { fontSize: 11 },
  label: {
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
  },
  labelSm: { fontSize: 11 },
});
