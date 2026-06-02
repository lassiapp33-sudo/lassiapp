import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { OrderInfo } from '../../types/payment';
import Avatar from '../Avatar';

interface Props { order: OrderInfo; }

export default function OrderRecap({ order }: Props) {
  return (
    <View style={styles.card}>
      {/* Ligne commerçant — Avatar unique pour le logo boutique */}
      <View style={styles.shopRow}>
        <Avatar
          imageUrl={undefined}
          name={order.shopName}
          size={40}
          variant="shop"
        />
        <View>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.shopLoc}>{order.shopLocation}</Text>
        </View>
      </View>

      {/* Articles */}
      {order.items.map((item, i) => (
        <View key={i} style={styles.line}>
          <Text style={styles.lineLeft}>
            <Text style={styles.lineQty}>{item.qty}×  </Text>
            {item.name}
          </Text>
          <Text style={styles.linePrice}>
            {item.price.toLocaleString('fr-FR')} F
          </Text>
        </View>
      ))}

      {/* Total */}
      <View style={styles.separator} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{order.total.toLocaleString('fr-FR')} F</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  shopLoc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  lineLeft: {
    color: '#cfd0e0',
    fontFamily: fonts.body,
    fontSize: 13,
    flex: 1,
  },
  lineQty: {
    color: colors.white,
    fontFamily: fonts.title,
  },
  linePrice: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  totalValue: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
  },
});
