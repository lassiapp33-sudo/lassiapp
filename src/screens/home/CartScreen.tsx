import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { OrderInfo } from '../../types/payment';
import useCartStore from '../../store/cartStore';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoNote = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoPay = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  shopId:     string;
  shopName:   string;
  onBack:     () => void;
  onCheckout: (order: OrderInfo) => void;
}

export default function CartScreen({ shopId, shopName, onBack, onCheckout }: Props) {
  const items      = useCartStore(s => s.items);
  const shopInfo   = useCartStore(s => s.shopInfo);
  const updateQty  = useCartStore(s => s.updateQty);
  const clearCart  = useCartStore(s => s.clearCart);

  const [note, setNote] = useState('');

  const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasItems    = items.length > 0;

  const displayInitial  = shopInfo?.initial  ?? shopName.charAt(0).toUpperCase();
  const displayName     = shopInfo?.name     ?? shopName;
  const displayLocation = shopInfo?.location ?? '';

  const handleCheckout = () => {
    const orderItems = items.map(i => ({ qty: i.qty, name: i.name, price: i.price * i.qty }));
    clearCart();
    onCheckout({
      ticketId:     'cart',
      orderId:      '#' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      shopInitial:  displayInitial,
      shopName:     displayName,
      shopLocation: displayLocation,
      items:        orderItems,
      total:        subtotal,
    });
  };

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Mon panier</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      >
        {/* Bandeau commerce */}
        <View style={styles.shopBand}>
          <View style={styles.shopLogo}>
            <Text style={styles.shopLogoTxt}>{displayInitial}</Text>
          </View>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName}>{displayName}</Text>
            <Text style={styles.shopLoc}>{displayLocation}</Text>
          </View>
        </View>

        {/* Articles */}
        {items.map(item => (
          <View key={item.id} style={styles.lineItem}>
            {/* Emoji ou initiale */}
            <View style={styles.itemThumb}>
              <Text style={styles.itemInitial}>{item.emoji || item.name.charAt(0).toUpperCase()}</Text>
            </View>

            {/* Nom + prix unitaire */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                {item.price.toLocaleString('fr-FR')} F
              </Text>
            </View>

            {/* Contrôles quantité */}
            <View style={styles.qtyWrap}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQty(item.id, item.qty - 1)}
                activeOpacity={0.75}
              >
                <Text style={styles.qtyBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{item.qty}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, styles.qtyBtnPlus]}
                onPress={() => updateQty(item.id, item.qty + 1)}
                activeOpacity={0.75}
              >
                <Text style={[styles.qtyBtnTxt, styles.qtyBtnPlusTxt]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Champ note */}
        <View style={styles.noteField}>
          <IcoNote />
          <TextInput
            style={styles.noteInput}
            placeholder="Ajouter une note (ex: bien sucré, sans piment…)"
            placeholderTextColor="#5a5c80"
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        {/* Résumé de commande */}
        <View style={styles.summary}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Sous-total</Text>
            <Text style={styles.summaryVal}>{subtotal.toLocaleString('fr-FR')} F</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryKey}>Type</Text>
            <Text style={styles.summaryVal}>À emporter</Text>
          </View>
          {/* Séparateur */}
          <View style={styles.separator} />
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>Total</Text>
            <Text style={styles.totalVal}>{subtotal.toLocaleString('fr-FR')} F</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer fixe — Commander */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, !hasItems && styles.payBtnDisabled]}
          onPress={hasItems ? handleCheckout : undefined}
          activeOpacity={0.85}
        >
          <IcoPay />
          <Text style={styles.payBtnTxt}>
            Commander · {subtotal.toLocaleString('fr-FR')} F
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // Header
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 20,
    flex: 1,
  },

  // Bandeau commerce
  shopBand: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  shopLogo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shopLogoTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  shopInfo: { flex: 1 },
  shopName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  shopLoc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },

  // Articles
  lineItem: {
    marginHorizontal: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineItemFaded: { opacity: 0.35 },

  itemThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#222447',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemInitial: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 22,
  },
  itemInfo: { flex: 1 },
  itemName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  itemPrice: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
    marginTop: 3,
  },

  // Contrôles qty
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 5,
    paddingHorizontal: 8,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: { backgroundColor: colors.accent },
  qtyBtnTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 16,
    lineHeight: 20,
  },
  qtyBtnPlusTxt: { color: colors.bg },
  qtyNum: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 14,
    minWidth: 14,
    textAlign: 'center',
  },

  // Champ note
  noteField: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noteInput: {
    flex: 1,
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 12.5,
    minHeight: 20,
  },

  // Résumé
  summary: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 15,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  summaryKey: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  summaryVal: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 5,
    marginBottom: 11,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalKey: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  totalVal: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
  },

  // Footer paiement
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(20,21,42,.97)',
  },
  payBtn: {
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
});
