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
import useCartStore, { selectShops, CartShop } from '../../store/cartStore';
import Avatar from '../../components/Avatar';
import { validateCartAvailability } from '../../services/products';
import { createOrderSecure, createVipOrder, uploadVoiceNote } from '../../services/orders';
import VoiceNoteRecorder from '../../components/VoiceNoteRecorder';
import * as promosService from '../../services/promotions';
import { AppliedDiscount } from '../../types/promotions';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { notifyError } from '../../utils/errorUtils';
import { calculerCommission, calculerPrixClient, calculerCommissionVip, calculerPrixClientVip, PAYMENT_CONFIG } from '../../config/payment';
import { PayMethod } from '../../types/payment';
import PayMethodCard from '../../components/payment/PayMethodCard';
import { WAVE_ENABLED } from '../../config/features';
import * as payService from '../../services/payment';
import { initierPaiement } from '../../services/paymentService';
import LivraisonModal from '../../components/livraison/LivraisonModal';
import { devisLivraisonMulti, LivraisonShopPoint } from '../../config/livraison';
import { getCurrentLocation } from '../../services/location';
import { SUPABASE_URL, SUPABASE_ANON } from '../../lib/supabase';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoNote = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoPay = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
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
  isVip?: boolean;
  vipOrderMode?: 'normal' | 'livraison';
}

export default function CartScreen({ shopId, shopName, onBack, onCheckout, isVip = false, vipOrderMode = 'normal' }: Props) {
  // ── Store ──────────────────────────────────────────────────────────────────
  const shops = useCartStore(selectShops);
  const orderType = useCartStore(s => s.orderType);
  const updateQtyInShop = useCartStore(s => s.updateQtyInShop);
  const removeItemFromShop = useCartStore(s => s.removeItemFromShop);
  const clearCart = useCartStore(s => s.clearCart);

  // Boutiques concernées par CE panier :
  //  - VIP  → uniquement la fiche VIP d'entrée (flux createVipOrder inchangé)
  //  - std  → toutes les boutiques standard du panier (multi-prestataire)
  const activeShops: CartShop[] = isVip
    ? shops.filter(sh => sh.info.id === shopId)
    : shops.filter(sh => !sh.info.isVip);

  const isMulti = !isVip && activeShops.length > 1;
  const singleShopId = activeShops.length === 1 ? activeShops[0].info.id : '';

  // ── Moyens de paiement : intersection de toutes les boutiques ───────────────
  const methodSets = activeShops.map(sh => sh.info.paymentMethods ?? (['wave', 'om'] as ('wave' | 'om')[]));
  let commonMethods: ('wave' | 'om')[] = methodSets.length
    ? methodSets.reduce((a, b) => a.filter(m => b.includes(m)))
    : ['wave', 'om'];
  if (commonMethods.length === 0) commonMethods = ['wave', 'om']; // ne jamais bloquer le paiement
  const merchantPayMethods = commonMethods.filter((m): m is PayMethod => m !== 'wave' || WAVE_ENABLED);

  // ── State local ────────────────────────────────────────────────────────────
  const [note, setNote] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountsByShop, setDiscountsByShop] = useState<Record<string, AppliedDiscount[]>>({});
  const [method, setMethod] = useState<PayMethod>(merchantPayMethods.includes('wave') ? 'wave' : 'om');
  const [showLivraisonModal, setShowLivraisonModal] = useState(false);
  const [shopPoints, setShopPoints] = useState<LivraisonShopPoint[]>([]);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);
  const livraisonFeeRef = useRef(0);
  const isSubmittingRef = useRef(false);

  // Livraison mono OU multi-boutiques : devis = ancre (boutique la plus proche)
  // + legs inter-boutiques (devisLivraisonMulti gère 1..N boutiques).
  const devisBtn =
    clientCoords && shopPoints.length > 0
      ? devisLivraisonMulti(shopPoints, clientCoords.lat, clientCoords.lng)
      : null;
  const anchorShopId = devisBtn?.anchorId ?? (activeShops[0]?.info.id ?? '');

  // ── Totaux par boutique ─────────────────────────────────────────────────────
  const shopTotals = (sh: CartShop) => {
    const subtotal = sh.items.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = (discountsByShop[sh.info.id] ?? []).reduce((s, d) => s + d.reductionFcfa, 0);
    const total = Math.max(subtotal - discount, 0);
    const commission = isVip ? calculerCommissionVip(total) : calculerCommission(total);
    const client = isVip ? calculerPrixClientVip(total) : calculerPrixClient(total);
    return { subtotal, discount, total, commission, client };
  };

  const perShop = activeShops.map(shopTotals);
  const grandTotal = perShop.reduce((s, t) => s + t.total, 0);
  const grandClient = perShop.reduce((s, t) => s + t.client, 0);
  const grandCommission = perShop.reduce((s, t) => s + t.commission, 0);

  const livraisonFeeDisplay = (isVip && vipOrderMode === 'livraison' && devisBtn && !devisBtn.horsZone)
    ? devisBtn.prix
    : 0;
  const grandTotalFinal = grandTotal + livraisonFeeDisplay;
  const grandClientFinal = grandClient + livraisonFeeDisplay;

  const hasItems = activeShops.some(sh => sh.items.length > 0);

  // ── Effets ────────────────────────────────────────────────────────────────
  const shopsKey = activeShops
    .map(sh => sh.info.id + ':' + sh.items.map(i => i.id + 'x' + i.qty).join(','))
    .join('|');

  // Promos par boutique (affichage ; le serveur recalcule la vraie réduction)
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      activeShops.map(async sh => {
        try {
          const promos = await promosService.getActivePromos(sh.info.id);
          return [sh.info.id, promosService.calcClientDiscount(promos, sh.items)] as const;
        } catch {
          return [sh.info.id, [] as AppliedDiscount[]] as const;
        }
      }),
    ).then(entries => {
      if (!cancelled) setDiscountsByShop(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopsKey]);

  // Coordonnées de TOUTES les boutiques du panier + position client (livraison)
  const shopIdsKey = activeShops.map(s => s.info.id).join(',');
  useEffect(() => {
    const entries = activeShops.map(s => ({ id: s.info.id, name: s.info.name }));
    if (entries.length === 0) { setShopPoints([]); return; }
    const inList = entries.map(e => encodeURIComponent(e.id)).join(',');
    fetch(
      `${SUPABASE_URL}/rest/v1/shops?select=id,latitude,longitude,name&id=in.(${inList})`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    )
      .then(r => r.json())
      .then((rows: Record<string, unknown>[]) => {
        const pts: LivraisonShopPoint[] = [];
        for (const e of entries) {
          const row = (rows ?? []).find(r => r.id === e.id);
          if (row?.latitude && row?.longitude) {
            pts.push({
              id: e.id,
              label: e.name || (row.name as string) || 'Boutique',
              lat: row.latitude as number,
              lng: row.longitude as number,
            });
          }
        }
        setShopPoints(pts);
      })
      .catch(() => {});
    getCurrentLocation().then(pos => {
      if (pos) { setClientCoords({ lat: pos.latitude, lng: pos.longitude }); setGeoFailed(false); }
      else setGeoFailed(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopIdsKey]);

  const retryGeoloc = () => {
    setGeoFailed(false);
    getCurrentLocation().then(pos => {
      if (pos) setClientCoords({ lat: pos.latitude, lng: pos.longitude });
      else setGeoFailed(true);
    });
  };

  // ── Checkout ──────────────────────────────────────────────────────────────

  const handleCheckout = async (payMethod?: PayMethod) => {
    const usedMethod: PayMethod = payMethod ?? method;
    setMethod(usedMethod);
    if (isSubmittingRef.current) return;

    if ((usedMethod === 'wave' || usedMethod === 'om') && grandTotalFinal < PAYMENT_CONFIG.MONTANT_MIN_FCFA) {
      Alert.alert(
        'Montant insuffisant',
        `Le montant minimum pour payer par Wave ou Orange Money est de ${PAYMENT_CONFIG.MONTANT_MIN_FCFA} FCFA. Ajoute d'autres articles ou contacte le prestataire directement.`,
        [{ text: 'OK' }],
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    let releaseInFinally = true;

    try {
      const freshShops = (useCartStore.getState().shops ?? []).filter(sh =>
        isVip ? sh.info.id === shopId : !sh.info.isVip,
      );
      if (freshShops.length === 0) return;

      // Validation disponibilité par boutique (skip VIP : IDs = prestations)
      if (!isVip) {
        const unavailable: { id: string; name: string }[] = [];
        for (const sh of freshShops) {
          const un = await validateCartAvailability(sh.info.id, [...new Set(sh.items.map(i => i.id))]);
          unavailable.push(...un);
        }
        if (unavailable.length > 0) {
          const ids = unavailable.map(u => u.id);
          for (const sh of freshShops) ids.forEach(id => removeItemFromShop(sh.info.id, id));
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
                  const left = (useCartStore.getState().shops ?? []).some(sh => sh.items.length > 0);
                  if (left) handleCheckout();
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
      }

      const structuredNote = note.trim() || undefined;

      let voiceNotePath: string | undefined;
      if (voiceNoteUri) {
        const p = await uploadVoiceNote(voiceNoteUri);
        if (p) voiceNotePath = p;
      }

      // Frais de livraison TOTAUX (ancre + legs inter-boutiques). Bakés dans la
      // commande de la boutique ANCRE uniquement (exclus de son payout → gardés
      // par LASSI pour le livreur). Les autres commandes : livraison_fee = 0.
      const freshLivraisonFee = (isVip && vipOrderMode === 'livraison' && devisBtn && !devisBtn.horsZone)
        ? devisBtn.prix
        : (!isVip ? livraisonFeeRef.current : 0);
      const freshAnchorId = freshShops.some(s => s.info.id === anchorShopId)
        ? anchorShopId
        : (freshShops[0]?.info.id ?? '');

      // ── VIP : flux inchangé (mono-boutique, prestations) ──────────────────
      if (isVip) {
        const sh = freshShops[0];
        const t = shopTotals(sh);
        const vipItems = sh.items.map(i => ({ prestationId: i.id, qty: i.qty }));
        const res = await createVipOrder(sh.info.id, vipItems, 'emporter', structuredNote, usedMethod, freshLivraisonFee);
        const amount = t.total + freshLivraisonFee;
        await finalizeSingle(res.orderId, sh.info.name, sh.info.initial, sh.info.location, sh.items, amount, t.commission, undefined, t.client + freshLivraisonFee);
        return;
      }

      // ── Standard : 1 commande par boutique ────────────────────────────────
      const freshOrderType = (freshShops.length === 1 && freshShops[0].info.showOrderType)
        ? useCartStore.getState().orderType
        : undefined;

      const orderIds: string[] = [];
      const recapItems: { qty: number; name: string; price: number }[] = [];
      for (const sh of freshShops) {
        const rawItems = sh.items.map(i => ({
          productId: i.productId ?? i.id,
          qty: i.qty,
          ...(i.selectedSize || i.selectedColor
            ? { variant: [i.selectedSize, i.selectedColor].filter(Boolean).join(', ') }
            : {}),
        }));
        const perShopLivraison = sh.info.id === freshAnchorId ? freshLivraisonFee : 0;
        const res = await createOrderSecure(
          sh.info.id, rawItems, structuredNote, freshOrderType, undefined, voiceNotePath, usedMethod, perShopLivraison,
        );
        orderIds.push(res.orderId);
        sh.items.forEach(i => recapItems.push({ qty: i.qty, name: i.name, price: i.price * i.qty }));
      }

      // 1 boutique → flux single existant (create-payment). ≥2 → flux groupé.
      if (orderIds.length === 1) {
        const sh = freshShops[0];
        const t = shopTotals(sh);
        const amount = t.total + freshLivraisonFee;
        await finalizeSingle(orderIds[0], sh.info.name, sh.info.initial, sh.info.location, sh.items, amount, t.commission, sh.info.merchantId, t.client + freshLivraisonFee);
        return;
      }

      // ── Paiement groupé multi-prestataire ─────────────────────────────────
      let groupSession;
      try {
        groupSession = await payService.createGroupPayment({ orderIds, method: usedMethod });
      } catch (payErr: unknown) {
        notifyError(payErr instanceof Error ? payErr.message : "Impossible d'initier le paiement. Réessaie.");
        return;
      }

      let paymentConfirmed = false;
      if (groupSession.simulation) {
        const paid = await payService.verifyGroupPayment(groupSession.groupId);
        if (!paid) { notifyError('Paiement simulé non confirmé. Réessaie.'); return; }
        paymentConfirmed = true;
      }

      clearCart();
      livraisonFeeRef.current = 0;
      onCheckout({
        ticketId:               groupSession.groupId,
        groupId:                groupSession.groupId,
        orderId:                '#' + groupSession.groupId.slice(0, 8).toUpperCase(),
        shopInitial:            'L',
        shopName:               `${freshShops.length} boutiques`,
        shopLocation:           '',
        items:                  recapItems,
        total:                  groupSession.montantTotal,
        commission:             grandCommission,
        preMethod:              usedMethod,
        paymentConfirmed,
        qrCode:                 groupSession.qrCode || undefined,
        paymentUrl:             groupSession.paymentUrl || undefined,
        merchantPaymentMethods: commonMethods,
      });
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie dans un instant.');
    } finally {
      if (releaseInFinally) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }

    // ── Flux paiement mono-commande (single / VIP) ────────────────────────
    async function finalizeSingle(
      realOrderId: string,
      sName: string,
      sInitial: string,
      sLocation: string,
      items: { id: string; name: string; price: number; qty: number }[],
      amount: number,
      commission: number,
      merchantId?: string,
      displayTotal?: number,
    ) {
      let preInitiatedPiId: string | undefined;
      let preQrCode: string | undefined;
      let prePaymentUrl: string | undefined;
      let paymentConfirmed = false;

      try {
        if (merchantId) {
          // Proper flow: crée payment_intent → déclenche payout → notifications
          const res = await initierPaiement({ orderId: realOrderId, prestataireId: merchantId, prixBase: amount, moyenPaiement: usedMethod });
          if (!res.success) throw new Error(res.error ?? "Impossible d'initier le paiement");
          preInitiatedPiId = res.paymentIntentId;
          preQrCode = res.qrCode || undefined;
          prePaymentUrl = res.redirectUrl || undefined;
          if (res.mode === 'simulation') {
            const paid = await payService.verifyPayment({ reference: res.paymentIntentId!, ticketId: realOrderId, method: usedMethod });
            if (!paid) { notifyError('Paiement simulé non confirmé. Réessaie.'); return; }
            paymentConfirmed = true;
          }
        } else {
          const session = await payService.createPayment({
            ticketId: realOrderId, amount, method: usedMethod, merchantName: sName,
          });
          preInitiatedPiId = session.reference;
          preQrCode = session.qrCode || undefined;
          prePaymentUrl = session.paymentUrl || undefined;
          if (session.simulation) {
            const paid = await payService.verifyPayment({ reference: session.reference, ticketId: realOrderId, method: usedMethod });
            if (!paid) { notifyError('Paiement simulé non confirmé. Réessaie.'); return; }
            paymentConfirmed = true;
          }
        }
      } catch (payErr: unknown) {
        notifyError(payErr instanceof Error ? payErr.message : "Impossible d'initier le paiement. Réessaie ou change de moyen.");
        return;
      }

      clearCart();
      livraisonFeeRef.current = 0;
      onCheckout({
        ticketId:               realOrderId,
        orderId:                '#' + realOrderId.slice(0, 8).toUpperCase(),
        shopInitial:            sInitial || sName.charAt(0).toUpperCase(),
        shopName:               sName,
        shopLocation:           sLocation,
        items:                  items.map(i => ({ qty: i.qty, name: i.name, price: i.price * i.qty })),
        total:                  displayTotal ?? amount,
        commission,
        orderType:              (activeShops[0]?.info.showOrderType) ? orderType : undefined,
        preMethod:              usedMethod,
        preInitiatedPiId,
        paymentConfirmed,
        qrCode:                 preQrCode,
        paymentUrl:             prePaymentUrl,
        merchantPaymentMethods: commonMethods,
      });
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {isMulti && (
            <View style={styles.multiBanner}>
              <Text style={styles.multiBannerTxt}>
                {activeShops.length} boutiques · un seul paiement, chaque commerçant reçoit sa commande
              </Text>
            </View>
          )}

          {!hasItems && (
            <View style={styles.emptyBasket}>
              <Text style={styles.emptyBasketTxt}>
                Ton panier est vide — ajoute des articles depuis une boutique.
              </Text>
            </View>
          )}

          {/* ── Une section par boutique ─────────────────────────────────── */}
          {activeShops.map(sh => {
            const t = shopTotals(sh);
            const shopDiscounts = discountsByShop[sh.info.id] ?? [];
            return (
              <View key={sh.info.id} style={styles.shopBlock}>
                <View style={styles.shopBand}>
                  <Avatar imageUrl={sh.info.logoUrl ?? undefined} name={sh.info.name} size={40} variant="shop" />
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{sh.info.name}</Text>
                    {!!sh.info.location && <Text style={styles.shopLoc}>{sh.info.location}</Text>}
                  </View>
                  <Text style={styles.shopSubtotal}>{formatPrice(t.client)}</Text>
                </View>

                {sh.items.map(item => (
                  <View key={item.id} style={styles.lineItem}>
                    <View style={styles.itemThumb}>
                      <Text style={styles.itemInitial}>{item.emoji || item.name.charAt(0).toUpperCase()}</Text>
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
                        onPress={() => updateQtyInShop(sh.info.id, item.id, item.qty - 1)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.qtyBtnTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyNum}>{item.qty}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, styles.qtyBtnPlus]}
                        onPress={() => updateQtyInShop(sh.info.id, item.id, item.qty + 1)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.qtyBtnTxt, styles.qtyBtnPlusTxt]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {shopDiscounts.map(d => (
                  <View key={d.promoId} style={styles.discountLine}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.discountKey}>{d.titre}</Text>
                      <Text style={styles.discountSub}>{d.label}</Text>
                    </View>
                    <Text style={styles.discountVal}>−{formatPrice(d.reductionFcfa)}</Text>
                  </View>
                ))}
              </View>
            );
          })}

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

          {/* Moyen de paiement — cliquer déclenche directement le paiement */}
          <Text style={styles.payMethodTitle}>
            {isVip ? 'Moyen de paiement' : 'Payer avec'}
          </Text>
          {merchantPayMethods.includes('wave') && (
            <PayMethodCard
              method="wave"
              selected={method === 'wave'}
              loading={isSubmitting}
              disabled={isSubmitting && method !== 'wave'}
              onSelect={() => { if (!isVip) { handleCheckout('wave'); } else { setMethod('wave'); } }}
            />
          )}
          {merchantPayMethods.includes('om') && (
            <PayMethodCard
              method="om"
              selected={method === 'om'}
              loading={isSubmitting}
              disabled={isSubmitting && method !== 'om'}
              onSelect={() => { if (!isVip) { handleCheckout('om'); } else { setMethod('om'); } }}
            />
          )}

          {/* Résumé */}
          <View style={styles.summary}>
            {activeShops.length > 1 &&
              activeShops.map(sh => (
                <View key={sh.info.id} style={styles.summaryLine}>
                  <Text style={styles.summaryKey}>{sh.info.name}</Text>
                  <Text style={styles.summaryVal}>{formatPrice(shopTotals(sh).total)}</Text>
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
              <Text style={styles.totalVal}>{formatPrice(grandClientFinal)}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer fixe — VIP uniquement (non-VIP = paiement direct via les cartes) */}
      {isVip && vipOrderMode === 'normal' && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.payBtn, (!hasItems || isSubmitting) && styles.payBtnDisabled]}
              onPress={() => handleCheckout()}
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
                  <Text style={styles.payBtnTxt}>Commander</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <LivraisonModal
        visible={showLivraisonModal}
        shopId={anchorShopId || singleShopId}
        shopName={activeShops[0]?.info.name ?? shopName}
        shops={shopPoints}
        onClose={() => setShowLivraisonModal(false)}
        onConfirmed={() => {
          setShowLivraisonModal(false);
          livraisonFeeRef.current = (devisBtn && !devisBtn.horsZone) ? devisBtn.prix : 0;
          handleCheckout(method);
        }}
      />
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, flex: 1 },

  multiBanner: {
    marginHorizontal: 18, marginBottom: 12, backgroundColor: 'rgba(253,207,52,.10)',
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, padding: 12,
  },
  multiBannerTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12, lineHeight: 17 },

  shopBlock: { marginBottom: 6 },
  shopBand: {
    marginHorizontal: 18, marginBottom: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  shopInfo: { flex: 1 },
  shopName: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  shopLoc: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, marginTop: 2 },
  shopSubtotal: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },

  emptyBasket: {
    marginHorizontal: 18, marginBottom: 12, padding: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: 'center',
  },
  emptyBasketTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  lineItem: { marginHorizontal: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemThumb: {
    width: 60, height: 60, borderRadius: 14, backgroundColor: '#222447',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemInitial: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  itemPrice: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13, marginTop: 3 },

  qtyWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 5, paddingHorizontal: 8,
  },
  qtyBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center', justifyContent: 'center' },
  qtyBtnPlus: { backgroundColor: colors.accent },
  qtyBtnTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 16, lineHeight: 20 },
  qtyBtnPlusTxt: { color: colors.bg },
  qtyNum: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 14, minWidth: 14, textAlign: 'center' },

  noteField: {
    marginHorizontal: 18, marginTop: 6, marginBottom: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 13, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  voiceField: {
    marginHorizontal: 18, marginBottom: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10,
  },
  noteInput: { flex: 1, color: '#5a5c80', fontFamily: fonts.body, fontSize: 12.5, minHeight: 44 },

  payMethodTitle: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.5,
    textTransform: 'uppercase', marginHorizontal: 18, marginBottom: 10, marginTop: 4,
  },

  summary: {
    marginHorizontal: 18, marginBottom: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 15,
  },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  summaryKey: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, flex: 1, marginRight: 8 },
  summaryVal: { color: colors.white, fontFamily: fonts.ui, fontSize: 12.5 },
  discountLine: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9, marginHorizontal: 18, gap: 8 },
  discountKey: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },
  discountSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, marginTop: 1 },
  discountVal: { color: '#5FD38A', fontFamily: fonts.titleXL, fontSize: 13, marginTop: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: 5, marginBottom: 11 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalKey: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  totalVal: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    // paddingBottom élevé sur Android : dégage la barre de navigation système
    // (edge-to-edge) pour ne plus masquer les boutons.
    padding: 14, paddingBottom: Platform.OS === 'android' ? 34 : 20, backgroundColor: 'rgba(20,21,42,.97)',
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  payBtn: {
    flex: 1, height: 55, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  livraisonBtn: {
    flex: 1.3, height: 55, borderRadius: radius.lg, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  livraisonBtnTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 12, textAlign: 'center' },
  livraisonBtnSub: { color: colors.bg, fontFamily: fonts.label, fontSize: 10, opacity: 0.8, marginTop: 1 },
});
