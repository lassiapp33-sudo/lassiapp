import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  IcoStatusLoading,
  IcoStatusOk,
  IcoStatusMoney,
  IcoStatusFail,
  IcoStatusReturn,
  IcoStatusSim,
  IcoStatusQuestion,
} from '../common/LassiIcons';

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
  bg: string;
  color: string;
}

const STATUS_CONFIG: Record<PaymentStatut, Config> = {
  pending:    { label: 'En attente',   bg: '#2A2C52', color: '#9A9EC4' },
  initiated:  { label: 'En cours…',   bg: '#1A2E4A', color: '#5BB8F5' },
  confirmed:  { label: 'Confirmé',    bg: '#1A3A2A', color: '#4DC78A' },
  split_done: { label: 'Payé',        bg: '#2A2200', color: '#FDCF34' },
  failed:     { label: 'Échoué',      bg: '#3A1A1A', color: '#F5655B' },
  refunded:   { label: 'Remboursé',   bg: '#2A1E10', color: '#F5A55B' },
  simulated:  { label: 'Simulé',      bg: '#251A38', color: '#B07BF5' },
};

function StatusIcon({ statut, size }: { statut: PaymentStatut | string; size: number }) {
  switch (statut) {
    case 'pending':    return <IcoStatusLoading size={size} />;
    case 'initiated':  return <IcoStatusLoading size={size} color="#5BB8F5" />;
    case 'confirmed':  return <IcoStatusOk size={size} />;
    case 'split_done': return <IcoStatusMoney size={size} />;
    case 'failed':     return <IcoStatusFail size={size} />;
    case 'refunded':   return <IcoStatusReturn size={size} />;
    case 'simulated':  return <IcoStatusSim size={size} />;
    default:           return <IcoStatusQuestion size={size} />;
  }
}

interface Props {
  statut: PaymentStatut | string;
  size?: 'sm' | 'md';
}

export default function PaymentStatusBadge({ statut, size = 'md' }: Props) {
  const cfg: Config = STATUS_CONFIG[statut as PaymentStatut] ?? {
    label: statut,
    bg: '#2A2C52',
    color: '#9A9EC4',
  };

  const isSm = size === 'sm';
  const iconSize = isSm ? 13 : 16;

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isSm && styles.badgeSm]}>
      <StatusIcon statut={statut} size={iconSize} />
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
  label: {
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
  },
  labelSm: { fontSize: 11 },
});
