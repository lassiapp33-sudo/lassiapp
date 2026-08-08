import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking,
  Image,
  Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import Avatar from '../../components/Avatar';
import { formatPrice } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import PayMethodCard from '../../components/payment/PayMethodCard';
import { WAVE_ENABLED } from '../../config/features';
import * as payService from '../../services/payment';
import { calculerPrixClient, calculerCommission } from '../../config/payment';
import { notifyError } from '../../utils/errorUtils';
import type { BlocALaUne, ElementALaUne } from '../../types/aLaUne';
import type { OrderInfo, PayMethod } from '../../types/payment';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface ShopInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(expireAt: string): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const calc = () => {
      const ms = new Date(expireAt).getTime() - Date.now();
      if (ms <= 0) return setLabel('Expiré');
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expireAt]);
  return label;
}

// ─── Carte élément ────────────────────────────────────────────────────────────

interface ElCardProps {
  el: ElementALaUne;
  highlighted: boolean;
  onShop: () => void;
  onCommander: () => void;
}

function ElCard({ el, highlighted, onShop, onCommander }: ElCardProps) {
  const hasPrix = el.prix > 0;
  const prixClient = hasPrix ? calculerPrixClient(el.prix) : 0;
  const commission = hasPrix ? calculerCommission(el.prix) : 0;

  return (
    <View style={[styles.elCard, highlighted && styles.elCardHighlight]}>
      {highlighted && <Text style={styles.elHighlightBadge}>Ce produit t'a été recommandé</Text>}
      <Text style={styles.elNom}>{el.nom}</Text>

      {hasPrix ? (
        <>
          <Text style={styles.elPrix}>{formatPrice(prixClient)}</Text>
          <Text style={styles.elCommission}>
            Prix vendeur {formatPrice(el.prix)} · +{formatPrice(commission)} frais LASSI (1%)
          </Text>
        </>
      ) : (
        <Text style={styles.elPrixNone}>Prix sur demande</Text>
      )}

      {hasPrix ? (
        <TouchableOpacity style={styles.shopBtn} onPress={onCommander} activeOpacity={0.8}>
          <Text style={styles.shopBtnTxt}>Commander</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.shopBtnSecondary} onPress={onShop} activeOpacity={0.8}>
          <Text style={styles.shopBtnSecondaryTxt}>Voir la boutique</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Feuille de paiement ──────────────────────────────────────────────────────

interface CheckoutSheetProps {
  el: ElementALaUne;
  shopName: string;
  loading: boolean;
  onConfirm: (method: PayMethod) => void;
  onClose: () => void;
}

function CheckoutSheet({ el, shopName, loading, onConfirm, onClose }: CheckoutSheetProps) {
  const [method, setMethod] = useState<PayMethod>(WAVE_ENABLED ? 'wave' : 'om');
  const prixClient = calculerPrixClient(el.prix);
  const commission = calculerCommission(el.prix);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.csOverlay}>
        <TouchableOpacity style={styles.csBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.csSheet}>
          <View style={styles.csHandle} />
          <Text style={styles.csTitle}>Commander</Text>
          <Text style={styles.csSub} numberOfLines={1}>{shopName}</Text>

          {/* Article */}
          <View style={styles.csItem}>
            <Text style={styles.csItemName} numberOfLines={2}>{el.nom}</Text>
          </View>

          {/* Résumé prix */}
          <View style={styles.csPriceBox}>
            <View style={styles.csPriceLine}>
              <Text style={styles.csTotalKey}>Total</Text>
              <Text style={styles.csTotalVal}>{formatPrice(prixClient)}</Text>
            </View>
          </View>

          {/* Moyen de paiement */}
          <Text style={styles.csMethodLabel}>Moyen de paiement</Text>
          {WAVE_ENABLED && <PayMethodCard method="wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />}
          <PayMethodCard method="om"   selected={method === 'om'}   onSelect={() => setMethod('om')} />

          {/* Bouton payer */}
          <TouchableOpacity
            style={[styles.csPayBtn, loading && styles.csPayBtnDisabled]}
            onPress={() => onConfirm(method)}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.csPayBtnTxt}>
                Payer avec {method === 'wave' ? 'Wave' : 'Orange Money'} · {formatPrice(prixClient)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  blocCode: string;
  elementIndex?: number;
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
  onPaymentPress: (order: OrderInfo) => void;
}

export default function BlocAlaUneScreen({ blocCode, elementIndex, onBack, onShopPress, onPaymentPress }: Props) {
  const [bloc, setBloc] = useState<BlocALaUne | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroH, setHeroH] = useState(Math.round(SCREEN_W * (9 / 16)));
  const [checkoutTarget, setCheckoutTarget] = useState<ElementALaUne | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const countdown = useCountdown(bloc?.expire_at ?? new Date(Date.now() + 3600000).toISOString());
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const { data: blocData } = await supabase
        .from('a_la_une')
        .select('*')
        .eq('code', blocCode)
        .single();

      if (!blocData) { setLoading(false); return; }
      setBloc(blocData as BlocALaUne);

      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, logo_url')
        .eq('merchant_id', blocData.prestataire_id)
        .maybeSingle();

      if (shopData) {
        setShop({ id: shopData.id, name: shopData.name, logoUrl: shopData.logo_url ?? null });
      }
      setLoading(false);
    })();
  }, [blocCode]);

  // Scroll vers l'élément ciblé une fois les données chargées
  useEffect(() => {
    if (elementIndex === undefined || !bloc?.elements) return;
    if (elementIndex > 0 && elementIndex < bloc.elements.length) {
      const timer = setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: elementIndex, animated: true, viewPosition: 0.2 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [elementIndex, bloc]);

  // ── Commander un article À la une ─────────────────────────────────────────

  const handlePayer = async (method: PayMethod) => {
    if (!checkoutTarget || !bloc || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.rpc('creer_commande_alaune', {
        p_bloc_id:    bloc.id,
        p_element_id: checkoutTarget.id,
        p_qty:        1,
      });
      if (error) throw new Error(error.message);

      const { orderId, totalClient, commission, elementNom, shopName: rpcShopName } = data as {
        orderId: string;
        totalClient: number;
        commission: number;
        elementNom: string;
        shopName: string;
      };

      // Initier le paiement Wave/OM
      let preInitiatedPiId: string | undefined;
      try {
        const session = await payService.createPayment({
          ticketId: orderId,
          amount: totalClient,
          method,
          merchantName: rpcShopName,
        });
        preInitiatedPiId = session.reference;
        if (session.paymentUrl) Linking.openURL(session.paymentUrl).catch(() => {});
      } catch (payErr: unknown) {
        notifyError(payErr instanceof Error ? payErr.message : 'Erreur lors du pré-paiement');
      }

      setCheckoutTarget(null);
      onPaymentPress({
        ticketId:    orderId,
        orderId:     '#' + orderId.slice(0, 8).toUpperCase(),
        shopInitial: (rpcShopName ?? '?').charAt(0).toUpperCase(),
        shopName:    rpcShopName,
        shopLocation: '',
        items: [{ qty: 1, name: elementNom, price: totalClient }],
        total:       totalClient,
        commission,
        preMethod:   method,
        preInitiatedPiId,
      });
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Impossible de commander. Réessaie.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <IcoBack />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }

  if (!bloc) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>À la une</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundTxt}>Ce bloc n'est plus disponible.</Text>
          <TouchableOpacity onPress={onBack} style={styles.retourBtn}>
            <Text style={styles.retourTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isExpire = new Date(bloc.expire_at).getTime() <= Date.now();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {shop && (
            <Avatar
              name={shop.name}
              imageUrl={shop.logoUrl}
              size={30}
              variant="shop"
            />
          )}
          <View>
            {shop && <Text style={styles.shopNameHeader} numberOfLines={1}>{shop.name}</Text>}
            <Text style={styles.headerTitle} numberOfLines={1}>{bloc.titre}</Text>
          </View>
        </View>
        {!isExpire && (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownTxt}>⏳ {countdown}</Text>
          </View>
        )}
        {isExpire && (
          <View style={[styles.countdownPill, styles.expiredPill]}>
            <Text style={[styles.countdownTxt, { color: colors.danger }]}>Expiré</Text>
          </View>
        )}
      </View>

      {/* Éléments */}
      <FlatList
        ref={flatRef}
        data={bloc.elements}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={() => (
          <>
            {bloc.image_url ? (
              <Image
                source={{ uri: bloc.image_url }}
                style={[styles.heroImage, { height: heroH }]}
                resizeMode="cover"
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  if (width > 0) setHeroH(Math.round(SCREEN_W * height / width));
                }}
              />
            ) : null}
            {bloc.description ? (
              <View style={styles.descBox}>
                <Text style={styles.descTxt}>{bloc.description}</Text>
              </View>
            ) : null}
          </>
        )}
        renderItem={({ item, index }) => (
          <ElCard
            el={item}
            highlighted={index === elementIndex}
            onShop={() => shop && onShopPress(shop.id, shop.name)}
            onCommander={() => !isExpire && setCheckoutTarget(item)}
          />
        )}
        ListFooterComponent={
          shop ? (
            <TouchableOpacity
              style={styles.voirBoutiqueGlobal}
              onPress={() => onShopPress(shop.id, shop.name)}
              activeOpacity={0.8}
            >
              <Text style={styles.voirBoutiqueTxt}>Voir toute la boutique de {shop.name}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Feuille de paiement */}
      {checkoutTarget && shop && (
        <CheckoutSheet
          el={checkoutTarget}
          shopName={shop.name}
          loading={checkoutLoading}
          onConfirm={handlePayer}
          onClose={() => !checkoutLoading && setCheckoutTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopNameHeader: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  countdownPill: {
    backgroundColor: colors.accent + '22',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expiredPill: { backgroundColor: colors.danger + '18' },
  countdownTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11 },

  heroImage: {
    width: SCREEN_W,
    marginBottom: 14,
    backgroundColor: colors.surface,
  },

  descBox: {
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
  },
  descTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },

  list: { paddingBottom: 20, gap: 12 },

  elCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  elCardHighlight: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  elHighlightBadge: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 8,
  },
  elNom: { color: colors.white, fontFamily: fonts.title, fontSize: 17, marginBottom: 4 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 18, marginBottom: 2 },
  elCommission: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 16,
  },
  elPrixNone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 14,
    fontStyle: 'italic',
  },

  shopBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  shopBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },

  shopBtnSecondary: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shopBtnSecondaryTxt: { color: colors.muted, fontFamily: fonts.title, fontSize: 14 },

  voirBoutiqueGlobal: {
    marginTop: 8,
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  voirBoutiqueTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },

  notFoundTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retourBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retourTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },

  // ── Checkout Sheet ──────────────────────────────────────────────────────────

  csOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  csBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  csSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  csHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  csTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 2,
  },
  csSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  csItem: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  csItemName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  csPriceBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  csPriceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  csPriceKey: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  csPriceVal: { color: colors.white, fontFamily: fonts.ui, fontSize: 12 },
  csSep: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  csTotalKey: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  csTotalVal: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },

  csMethodLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 8,
  },

  csPayBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  csPayBtnDisabled: { opacity: 0.5 },
  csPayBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
});
