import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { OrderInfo } from '../../types/payment';
import useCartStore from '../../store/cartStore';
import Avatar from '../../components/Avatar';
import { validateCartAvailability } from '../../services/products';
import * as promosService from '../../services/promotions';
import { AppliedDiscount } from '../../types/promotions';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { notifyError } from '../../utils/errorUtils';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoNote = () => (
  <Svg
    width={17}
    height={17}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoPay = () => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  shopId: string;
  shopName: string;
  onBack: () => void;
  onCheckout: (order: OrderInfo) => void;
}

export default function CartScreen({ shopId, shopName, onBack, onCheckout }: Props) {
  const items = useCartStore(s => s.items);
  const shopInfo = useCartStore(s => s.shopInfo);
  const orderType = useCartStore(s => s.orderType);
  const updateQty = useCartStore(s => s.updateQty);

  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discounts, setDiscounts] = useState<AppliedDiscount[]>([]);

  // Garde synchrone anti-double-clic — la ref se met à jour immédiatement,
  // sans attendre un cycle de rendu React.
  const isSubmittingRef = useRef(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalDiscount = discounts.reduce((s, d) => s + d.reductionFcfa, 0);
  const total = Math.max(subtotal - totalDiscount, 0);

  // Charger les promos actives du shop pour l'affichage (calcul serveur au paiement)
  useEffect(() => {
    const sid = shopId || shopInfo?.id || '';
    if (!sid || items.length === 0) {
      setDiscounts([]);
      return;
    }
    promosService
      .getActivePromos(sid)
      .then(promos => {
        setDiscounts(promosService.calcClientDiscount(promos, items));
      })
      .catch(() => {});
  }, [shopId, shopInfo?.id, items]);

  const hasItems = items.length > 0;

  const displayName = shopInfo?.name ?? shopName;
  const displayLocation = shopInfo?.location ?? '';

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    // ① Garde synchrone : bloque tout appel concurrent avant le prochain rendu
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Quand l'alerte "article indisponible" est affichée, on ne libère pas
    // le verrou dans le bloc finally — les boutons de l'alerte s'en chargent.
    let releaseInFinally = true;

    try {
      // ② Lire l'état FRAIS du store (évite la closure périmée)
      const store = useCartStore.getState();
      const freshItems = store.items;

      if (freshItems.length === 0) return;

      const sid = shopId || store.shopInfo?.id || '';
      const unavailable = await validateCartAvailability(
        sid,
        freshItems.map(i => i.id),
      );

      if (unavailable.length > 0) {
        // ③ Retirer complètement (qty→0) les articles indisponibles
        const { updateQty: storeUpdateQty } = useCartStore.getState();
        unavailable.forEach(u => storeUpdateQty(u.id, 0));

        const names = unavailable.map(u => `• ${u.name}`).join('\n');
        releaseInFinally = false; // Les boutons de l'alerte libèrent le verrou

        Alert.alert(
          'Article(s) indisponible(s)',
          `Ces articles ne sont plus disponibles :\n${names}\n\nRetire-les pour continuer.`,
          [
            {
              text: 'Retirer et continuer',
              onPress: () => {
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                // Relancer avec l'état frais (stale closure corrigée)
                if (useCartStore.getState().items.length > 0) handleCheckout();
              },
            },
            {
              text: 'Annuler',
              style: 'cancel',
              onPress: () => {
                isSubmittingRef.current = false;
                setIsSubmitting(false);
              },
            },
          ],
        );
        return;
      }

      // ④ Recalculer le total depuis l'état frais (pas depuis la closure)
      const freshStore = useCartStore.getState();
      const freshSubtotal = freshStore.items.reduce((s, i) => s + i.price * i.qty, 0);
      // Les discounts locaux (state React) sont cohérents avec l'état frais si les
      // items n'ont pas changé ; le serveur recalcule de toute façon.
      const freshTotal = Math.max(freshSubtotal - totalDiscount, 0);

      const orderItems = freshStore.items.map(i => ({
        qty: i.qty,
        name: i.name,
        price: i.price * i.qty,
      }));
      const freshShopInfo = freshStore.shopInfo;
      const freshOrderType = freshStore.orderType;

      freshStore.clearCart();
      onCheckout({
        ticketId: 'cart',
        orderId: '#' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        shopInitial: freshShopInfo?.initial ?? shopName.charAt(0).toUpperCase(),
        shopName: freshShopInfo?.name ?? shopName,
        shopLocation: freshShopInfo?.location ?? '',
        items: orderItems,
        total: freshTotal,
        orderType: freshOrderType,
      });
    } catch {
      notifyError('Une erreur est survenue. Réessaie dans un instant.');
    } finally {
      if (releaseInFinally) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headTitle}>Mon panier</Text>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Bandeau commerce — Avatar unique pour le logo */}
          <View style={styles.shopBand}>
            <Avatar
              imageUrl={shopInfo?.logoUrl ?? undefined}
              name={displayName}
              size={44}
              variant="shop"
            />
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
                <Text style={styles.itemInitial}>
                  {item.emoji || item.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Nom + prix unitaire */}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
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
              <Text style={styles.summaryVal}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Type</Text>
              <Text style={styles.summaryVal}>
                {orderType === 'place' ? '🍽 Sur place' : '🥡 À emporter'}
              </Text>
            </View>
            {/* Lignes de réduction (display-only, le serveur recalcule) */}
            {discounts.map(d => (
              <View key={d.promoId} style={styles.discountLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.discountKey}>🏷️ {d.titre}</Text>
                  <Text style={styles.discountSub}>{d.label}</Text>
                </View>
                <Text style={styles.discountVal}>−{formatPrice(d.reductionFcfa)}</Text>
              </View>
            ))}
            {/* Séparateur */}
            <View style={styles.separator} />
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>Total</Text>
              <Text style={styles.totalVal}>{formatPrice(total)}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer fixe — Commander */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, (!hasItems || isSubmitting) && styles.payBtnDisabled]}
          onPress={handleCheckout}
          activeOpacity={0.85}
          disabled={!hasItems || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <IcoPay />
              <Text style={styles.payBtnTxt}>Commander · {formatPrice(total)}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
  discountLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 9,
    gap: 8,
  },
  discountKey: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  discountSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },
  discountVal: {
    color: '#5FD38A',
    fontFamily: fonts.titleXL,
    fontSize: 13,
    marginTop: 1,
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
