import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import { formatPrice } from '../../utils/format';

export type OrderStatus = 'new' | 'preparing';

export interface MerchantOrder {
  id: string;
  initial: string;
  name: string;
  avatarUrl?: string | null;
  items: string; // ex : "2× Pain-œuf · 1× Café"
  timeAgo: string; // ex : "il y a 2 min" ou "en préparation"
  status: OrderStatus;
  price: number;
}

// ─── Badge statut ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  new: {
    label: 'NOUVELLE',
    bg: 'rgba(95,211,138,.15)',
    color: colors.success,
  },
  preparing: {
    label: 'EN COURS',
    bg: 'rgba(240,168,71,.15)',
    color: colors.orange,
  },
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  order: MerchantOrder;
  onPress?: () => void;
}

export default function OrderCard({ order, onPress }: Props) {
  const status = STATUS_CONFIG[order.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar client — Avatar unique, source de vérité profiles.avatar_url */}
      <Avatar imageUrl={order.avatarUrl} name={order.name} size={44} variant="user" />

      {/* Infos commande */}
      <View style={styles.info}>
        <Text style={styles.name}>{order.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {order.items}
          {'  ·  '}
          <Text style={styles.metaAccent}>{order.timeAgo}</Text>
        </Text>
      </View>

      {/* Statut + prix */}
      <View style={styles.right}>
        <View style={[styles.tag, { backgroundColor: status.bg }]}>
          <Text style={[styles.tagTxt, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.price}>{formatPrice(order.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  metaAccent: {
    color: colors.accent,
    fontFamily: fonts.ui,
  },

  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  tagTxt: {
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
  price: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
