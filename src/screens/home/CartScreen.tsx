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
import useCartStore, { selectActiveItems, SubBasket } from '../../store/cartStore';
import Avatar from '../../components/Avatar';
import { validateCartAvailability } from '../../services/products';
import { createOrderSecure, createVipOrder, uploadVoiceNote } from '../../services/orders';
import VoiceNoteRecorder from '../../components/VoiceNoteRecorder';
import * as promosService from '../../services/promotions';
import { AppliedDiscount } from '../../types/promotions';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { notifyError } from '../../utils/errorUtils';
import { calculerCommission, calculerPrixClient, calculerCommissionVip, calculerPrixClientVip } from '../../config/payment';
import { PayMethod } from '../../types/payment';
import PayMethodCard from '../../components/payment/PayMethodCard';
import { WAVE_ENABLED } from '../../config/features';
import * as payService from '../../services/payment';
import LivraisonModal from '../../components/livraison/LivraisonModal';
import { devisLivraison } from '../../config/livraison';
import { getCurrentLocation } from '../../services/location';
import { SUPABASE_URL, SUPABASE_ANON } from '../../lib/supabase';

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

// ─── Helpers multi-panier ─────────────────────────────────────────────────────

function mergeBasketItems(baskets: SubBasket[]) {
  const map = new Map<string, SubBasket['items'][number]>();
  for (const basket of baskets) {
    for (const item of basket.items) {
      const ex = map.get(item.id);
      map.set(item.id, ex ? { ...ex, qty: ex.qty + item.qty } : { ...item });
    }
  }
  return Array.from(map.values());
}

function buildOrderNote(baskets: SubBasket[], userNote: string): string | undefined {
  const filled = baskets.filter(b => b.items.length > 0);
  if (filled.length <= 1) return userNote || undefined;
  const parts = filled.map(
    b => `${b.label}: ${b.items.map(i => `${i.name} x${i.qty}`).join(', ')}`,
  );
  const basketsNote = parts.join(' | ');
  return userNote ? `${basketsNote}\nNote: ${userNote}` : basketsNote;
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  shopId: string;
  shopName: string;
  onBack: () => void;
  onCheckout: (order: OrderInfo) => void;
  isVip?: boolean;
  vipOrderMode?: 'normal' | 'livraison';
}

const BASKET_PRESETS = ['Pour moi', 'Pour papa', 'Pour maman', 'Pour un ami'];

export default function CartScreen({ shopId, shopName, onBack, onCheckout, isVip = false, vipOrderMode = 'normal' }: Props) {
  // ── Store ──────────────────────────────────────────────────────────────────
  const baskets = useCartStore(s => s.baskets);
  const activeBasketId = useCartStore(s => s.activeBasketId);
  const shopInfo = useCartStore(s => s.shopInfo);
  const orderType = useCartStore(s => s.orderType);
  const updateQty = useCartStore(s => s.updateQty);
  const addBasket = useCartStore(s => s.addBasket);
  const removeBasket = useCartStore(s => s.removeBasket);
  const setActiveBasket = useCartStore(s => s.setActiveBasket);
  const removeFromAllBaskets = useCartStore(s => s.removeFromAllBaskets);

  // Items du panier actif uniquement (pour l'affichage de la liste)
  const items = useCartStore(selectActiveItems);

  // ── State local ────────────────────────────────────────────────────────────
  const [note, setNote] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discounts, setDiscounts] = useState<AppliedDiscount[]>([]);
  const [method, setMethod] = useState<PayMethod>(WAVE_ENABLED ? 'wave' : 'om');
  const [showLivraisonModal, setShowLivraisonModal] = useState(false);
  const [shopCoords, setShopCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showAddBasket, setShowAddBasket] = useState(false);
  const [newBasketName, setNewBasketName] = useState('');
  const livraisonFeeRef = useRef(0);

  // ── Données agrégées (tous paniers) ───────────────────────────────────────
  const allMergedItems = mergeBasketItems(baskets);

  const devisBtn =
    shopCoords && clientCoords
      ? devisLivraison(shopCoords.lat, shopCoords.lng, clientCoords.lat, clientCoords.lng)
      : null;

  const isSubmittingRef = useRef(false);

  const subtotal = allMergedItems.reduce((s, i) => s + i.price * i.qty, 0);
  const totalDiscount = discounts.reduce((s, d) => s + d.reductionFcfa, 0);
  const total = Math.max(subtotal - totalDiscount, 0);
  const commission = isVip ? calculerCommissionVip(total) : calculerCommission(total);
  const totalClient = isVip ? calculerPrixClientVip(total) : calculerPrixClient(total);

  // Frais de livraison affichés dans le récap pour le mode VIP livraison
  const livraisonFeeDisplay = (isVip && vipOrderMode === 'livraison' && devisBtn && !devisBtn.horsZone)
    ? devisBtn.prix
    : 0;
  const totalClientFinal = totalClient + livraisonFeeDisplay;

  // ── Effets ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const sid = shopId || shopInfo?.id || '';
    if (!sid) return;
    fetch(
      `${SUPABASE_URL}/rest/v1/shops?select=latitude,longitude&id=eq.${encodeURIComponent(sid)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    )
      .then(r => r.json())
      .then((rows: Record<string, unknown>[]) => {
        const data = rows[0];
        if (data?.latitude && data?.longitude)
          setShopCoords({ lat: data.latitude as number, lng: data.longitude as number });
      })
      .catch(() => {});
    getCurrentLocation().then(pos => {
      if (pos) setClientCoords({ lat: pos.latitude, lng: pos.longitude });
    });
  }, [shopId, shopInfo?.id]);

  useEffect(() => {
    const sid = shopId || shopInfo?.id || '';
    if (!sid || allMergedItems.length === 0) {
      setDiscounts([]);
      return;
    }
    promosService
      .getActivePromos(sid)
      .then(promos => {
        setDiscounts(promosService.calcClientDiscount(promos, allMergedItems));
      })
      .catch(() => {});
  // baskets comme dépendance : re-calcul dès qu'un panier change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, shopInfo?.id, baskets]);

  // ── Gestion paniers ───────────────────────────────────────────────────────

  const confirmAddBasket = (label: string) => {
    addBasket(label);
    setShowAddBasket(false);
    setNewBasketName('');
  };

  // ── Checkout ──────────────────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    let releaseInFinally = true;

    try {
      const store = useCartStore.getState();
      const freshBaskets = store.baskets;
      const freshMerged = mergeBasketItems(freshBaskets);

      if (freshMerged.length === 0) return;

      const sid = shopId || store.shopInfo?.id || '';

      // Pour les boutiques VIP, les IDs sont des prestations (pas des produits) — skip la validation products
      const unavailable = isVip
        ? []
        : await validateCartAvailability(sid, [...new Set(freshBaskets.flatMap(b => b.items.map(i => i.id)))]);

      if (unavailable.length > 0) {
        removeFromAllBaskets(unavailable.map(u => u.id));

        const names = unavailable.map(u => `• ${u.name}`).join('\n');
        releaseInFinally = false;

        Alert.alert(
          'Article(s) indisponible(s)',
          `Ces articles ne sont plus disponibles :\n${names}\n\nRetire-les pour continuer.`,
          [
            {
              text: 'Retirer et continuer',
              onPress: () => {
                isSubmittingRef.current = false;
                setIsSubmitting(false);
                const anyLeft = mergeBasketItems(useCartStore.getState().baskets).length > 0;
                if (anyLeft) handleCheckout();
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

      const freshStore = useCartStore.getState();
      const freshAllMerged = mergeBasketItems(freshStore.baskets);
      const freshSubtotal = freshAllMerged.reduce((s, i) => s + i.price * i.qty, 0);
      const freshTotal = Math.max(freshSubtotal - totalDiscount, 0);
      const freshCommission = isVip ? calculerCommissionVip(freshTotal) : calculerCommission(freshTotal);
      const freshTotalClient = isVip ? calculerPrixClientVip(freshTotal) : calculerPrixClient(freshTotal);

      // Frais de livraison : VIP livraison = devisBtn, standard = ref stockée après confirmation LivraisonModal
      const freshLivraisonFee = (isVip && vipOrderMode === 'livraison' && devisBtn && !devisBtn.horsZone)
        ? devisBtn.prix
        : livraisonFeeRef.current;
      const freshTotalAvecLivraison = freshTotalClient + freshLivraisonFee;

      const orderItems = freshAllMerged.map(i => ({
        qty: i.qty,
        name: i.name,
        price: i.price * i.qty,
      }));

      const structuredNote = buildOrderNote(freshStore.baskets, note.trim());
      const freshShopInfo = freshStore.shopInfo;
      const freshOrderType = freshShopInfo?.showOrderType ? freshStore.orderType : undefined;

      let voiceNotePath: string | undefined;
      if (voiceNoteUri) {
        const path = await uploadVoiceNote(voiceNoteUri);
        if (path) voiceNotePath = path;
      }

      let realOrderId: string;
      if (isVip) {
        // Commande VIP : IDs = prestations, pas des products → create-vip-order EF
        const vipItems = freshAllMerged.map(i => ({ prestationId: i.id, qty: i.qty }));
        const res = await createVipOrder(
          sid,
          vipItems,
          vipOrderMode === 'livraison' ? 'emporter' : 'emporter',
          structuredNote ?? undefined,
          method,
        );
        realOrderId = res.orderId;
      } else {
        const rawItems = freshAllMerged.map(i => ({ productId: i.id, qty: i.qty }));
        const res = await createOrderSecure(
          sid,
          rawItems,
          structuredNote,
          freshOrderType,
          undefined,
          voiceNotePath,
          method,
        );
        realOrderId = res.orderId;
      }

      let preInitiatedPiId: string | undefined;
      let paymentConfirmed = false;
      let preQrCode: string | undefined;
      let prePaymentUrl: string | undefined;

      try {
        const session = await payService.createPayment({
          ticketId: realOrderId,
          amount: freshTotalAvecLivraison,
          method,
          merchantName: freshShopInfo?.name ?? shopName,
        });
        preInitiatedPiId = session.reference;
        preQrCode = session.qrCode || undefined;
        prePaymentUrl = session.paymentUrl || undefined;

        if (session.simulation) {
          const paid = await payService.verifyPayment({
            reference: session.reference,
            ticketId: realOrderId,
            method,
          });
          if (!paid) {
            notifyError(
              'Paiement simulé non confirmé. Réessaie.',
            );
            return;
          }
          paymentConfirmed = true;
        }
      } catch (payErr: unknown) {
        notifyError(
          payErr instanceof Error
            ? payErr.message
            : "Impossible d'initier le paiement. Réessaie ou change de moyen.",
        );
        return;
      }

      freshStore.clearCart();
      livraisonFeeRef.current = 0;
      onCheckout({
        ticketId: realOrderId,
        orderId: '#' + realOrderId.slice(0, 8).toUpperCase(),
        shopInitial: freshShopInfo?.initial ?? shopName.charAt(0).toUpperCase(),
        shopName: freshShopInfo?.name ?? shopName,
        shopLocation: freshShopInfo?.location ?? '',
        items: orderItems,
        total: freshTotalAvecLivraison,
        commission: freshCommission,
        orderType: freshOrderType,
        preMethod: method,
        preInitiatedPiId,
        paymentConfirmed,
        qrCode: preQrCode,
        paymentUrl: prePaymentUrl,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie dans un instant.';
      notifyError(msg);
    } finally {
      if (releaseInFinally) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const hasItems = allMergedItems.length > 0;
  const displayName = shopInfo?.name ?? shopName;
  const displayLocation = shopInfo?.location ?? '';
  const filledBaskets = baskets.filter(b => b.items.length > 0);
  const multipleBaskets = filledBaskets.length > 1;

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
          {/* Bandeau commerce */}
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

          {/* ── Onglets paniers ─────────────────────────────────────────── */}
          <View style={styles.basketTabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.basketTabsContent}
            >
              {baskets.map(b => {
                const isActive = b.id === activeBasketId;
                const bQty = b.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.basketTab, isActive && styles.basketTabActive]}
                    onPress={() => setActiveBasket(b.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.basketTabTxt, isActive && styles.basketTabTxtActive]}>
                      {b.label}
                    </Text>
                    {bQty > 0 && (
                      <View style={[styles.basketTabBadge, isActive && styles.basketTabBadgeActive]}>
                        <Text style={[styles.basketTabBadgeTxt, isActive && styles.basketTabBadgeTxtActive]}>
                          {bQty}
                        </Text>
                      </View>
                    )}
                    {baskets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeBasket(b.id)}
                        style={styles.basketTabClose}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      >
                        <Text style={[styles.basketTabCloseTxt, isActive && styles.basketTabCloseTxtActive]}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Bouton ajouter un panier */}
              <TouchableOpacity
                style={styles.basketTabAdd}
                onPress={() => setShowAddBasket(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.basketTabAddTxt}>+ Panier</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ── Panneau d'ajout de panier ────────────────────────────────── */}
          {showAddBasket && (
            <View style={styles.addBasketPanel}>
              <Text style={styles.addBasketLabel}>Commande pour :</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetsRow}
              >
                {BASKET_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={styles.presetChip}
                    onPress={() => confirmAddBasket(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.presetChipTxt}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.customNameRow}>
                <TextInput
                  style={styles.customNameInput}
                  placeholder="Autre prénom…"
                  placeholderTextColor="#5a5c80"
                  value={newBasketName}
                  onChangeText={setNewBasketName}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (newBasketName.trim()) confirmAddBasket(newBasketName.trim());
                  }}
                />
                <TouchableOpacity
                  style={[styles.customNameOk, !newBasketName.trim() && { opacity: 0.35 }]}
                  onPress={() => {
                    if (newBasketName.trim()) confirmAddBasket(newBasketName.trim());
                  }}
                  disabled={!newBasketName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customNameOkTxt}>OK</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.customNameCancel}
                  onPress={() => setShowAddBasket(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customNameCancelTxt}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Articles du panier actif ─────────────────────────────────── */}
          {items.length === 0 ? (
            <View style={styles.emptyBasket}>
              <Text style={styles.emptyBasketTxt}>
                Ce panier est vide — ajoute des articles depuis la boutique.
              </Text>
            </View>
          ) : (
            items.map(item => (
              <View key={item.id} style={styles.lineItem}>
                <View style={styles.itemThumb}>
                  <Text style={styles.itemInitial}>
                    {item.emoji || item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {formatPrice(isVip ? calculerPrixClientVip(item.price) : calculerPrixClient(item.price))}
                  </Text>
                </View>
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
            ))
          )}

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

          {/* Message vocal optionnel */}
          <View style={styles.voiceField}>
            <VoiceNoteRecorder onRecordingComplete={setVoiceNoteUri} />
          </View>

          {/* Moyen de paiement */}
          <Text style={styles.payMethodTitle}>Moyen de paiement</Text>
          {WAVE_ENABLED && (
            <PayMethodCard
              method="wave"
              selected={method === 'wave'}
              onSelect={() => setMethod('wave')}
            />
          )}
          <PayMethodCard
            method="om"
            selected={method === 'om'}
            onSelect={() => setMethod('om')}
          />

          {/* Résumé de commande */}
          <View style={styles.summary}>
            {/* Sous-totaux par panier (seulement si plusieurs paniers avec des articles) */}
            {multipleBaskets &&
              filledBaskets.map(b => {
                const bTotal = b.items.reduce((s, i) => s + i.price * i.qty, 0);
                return (
                  <View key={b.id} style={styles.summaryLine}>
                    <Text style={styles.summaryKey}>{b.label}</Text>
                    <Text style={styles.summaryVal}>{formatPrice(calculerPrixClient(bTotal))}</Text>
                  </View>
                );
              })}

            {totalDiscount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryKey}>Sous-total</Text>
                <Text style={styles.summaryVal}>{formatPrice(subtotal)}</Text>
              </View>
            )}
            {shopInfo?.showOrderType && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryKey}>Type</Text>
                <Text style={styles.summaryVal}>
                  {orderType === 'place' ? 'Sur place' : 'À emporter'}
                </Text>
              </View>
            )}
            {discounts.map(d => (
              <View key={d.promoId} style={styles.discountLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.discountKey}>{d.titre}</Text>
                  <Text style={styles.discountSub}>{d.label}</Text>
                </View>
                <Text style={styles.discountVal}>−{formatPrice(d.reductionFcfa)}</Text>
              </View>
            ))}
            {livraisonFeeDisplay > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryKey}>Frais de livraison</Text>
                <Text style={styles.summaryVal}>{formatPrice(livraisonFeeDisplay)}</Text>
              </View>
            )}
            <View style={styles.separator} />
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>Total</Text>
              <Text style={styles.totalVal}>{formatPrice(totalClientFinal)}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer fixe — Commander */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          {/* Bouton Commander (paiement direct) — masqué pour VIP + livraison */}
          {(!isVip || vipOrderMode === 'normal') && (
            <TouchableOpacity
              style={[styles.payBtn, (!hasItems || isSubmitting) && styles.payBtnDisabled]}
              onPress={handleCheckout}
              activeOpacity={0.85}
              disabled={!hasItems || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.payBtnTxt}>Traitement…</Text>
                </>
              ) : (
                <>
                  <IcoPay />
                  <Text style={styles.payBtnTxt}>
                    {isVip ? 'Commander' : `${method === 'wave' ? 'Wave' : 'OM'} · ${formatPrice(totalClient)}`}
                  </Text>
                  {!isVip && <Text style={styles.payBtnSub}>Sans livraison</Text>}
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Bouton Commander + Livrer — masqué pour VIP + commander simple */}
          {(!isVip || vipOrderMode === 'livraison') && (
            <TouchableOpacity
              style={[
                styles.livraisonBtn,
                (!hasItems || isSubmitting || devisBtn?.horsZone === true) && styles.payBtnDisabled,
              ]}
              onPress={() => isVip ? handleCheckout() : setShowLivraisonModal(true)}
              activeOpacity={0.85}
              disabled={!hasItems || isSubmitting || devisBtn?.horsZone === true}
            >
              {!isVip && devisBtn && !devisBtn.horsZone ? (
                <>
                  <Text style={styles.livraisonBtnTxt}>
                    {`Commander + Livrer · ${formatPrice(totalClient + devisBtn.prix)}`}
                  </Text>
                  <Text style={styles.livraisonBtnSub}>{`Livraison +${formatPrice(devisBtn.prix)}`}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.livraisonBtnTxt}>Commander + Livrer</Text>
                  {!isVip && (
                    <Text style={styles.livraisonBtnSub}>
                      {devisBtn == null ? '…' : 'Hors zone'}
                    </Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <LivraisonModal
        visible={showLivraisonModal}
        shopId={shopId || shopInfo?.id || ''}
        shopName={displayName}
        onClose={() => setShowLivraisonModal(false)}
        onConfirmed={_livraisonId => {
          setShowLivraisonModal(false);
          livraisonFeeRef.current = (devisBtn && !devisBtn.horsZone) ? devisBtn.prix : 0;
          handleCheckout();
        }}
      />
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
    marginBottom: 14,
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

  // ── Onglets paniers ────────────────────────────────────────────────────────
  basketTabsWrap: {
    marginBottom: 14,
  },
  basketTabsContent: {
    paddingHorizontal: 18,
    gap: 8,
    alignItems: 'center',
  },
  basketTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  basketTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  basketTabTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },
  basketTabTxtActive: {
    color: colors.bg,
    fontFamily: fonts.title,
  },
  basketTabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  basketTabBadgeActive: {
    backgroundColor: 'rgba(20,21,42,.25)',
  },
  basketTabBadgeTxt: {
    color: colors.muted,
    fontFamily: fonts.titleXL,
    fontSize: 10,
  },
  basketTabBadgeTxtActive: {
    color: colors.bg,
  },
  basketTabClose: {
    marginLeft: 2,
  },
  basketTabCloseTxt: {
    color: colors.muted,
    fontFamily: fonts.titleXL,
    fontSize: 15,
    lineHeight: 16,
  },
  basketTabCloseTxtActive: {
    color: colors.bg,
  },
  basketTabAdd: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  basketTabAddTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },

  // ── Panneau ajout panier ───────────────────────────────────────────────────
  addBasketPanel: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  addBasketLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexGrow: 0,
  },
  presetChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#222447',
    marginRight: 8,
  },
  presetChipTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },
  customNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customNameInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#222447',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  customNameOk: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customNameOkTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  customNameCancel: {
    height: 38,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customNameCancelTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // Panier vide
  emptyBasket: {
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  emptyBasketTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Articles
  lineItem: {
    marginHorizontal: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
    marginBottom: 10,
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
  voiceField: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteInput: {
    flex: 1,
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 12.5,
    minHeight: 44,
  },

  // Moyen de paiement
  payMethodTitle: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginHorizontal: 18,
    marginBottom: 10,
    marginTop: 4,
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
    backgroundColor: 'rgba(20,21,42,.97)',
  },
  payBtn: {
    flex: 1,
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  payBtnSub: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 10,
    marginTop: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  livraisonBtn: {
    flex: 1.3,
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  livraisonBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  livraisonBtnSub: {
    color: colors.bg,
    fontFamily: fonts.label,
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2,
  },
});
