import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  Image,
} from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

import VisibilityHeader from '../../components/visibility/VisibilityHeader';
import HeroCard from '../../components/visibility/HeroCard';
import BenefitsList from '../../components/visibility/BenefitsList';
import PlanCard from '../../components/visibility/PlanCard';
import ProductPicker from '../../components/visibility/ProductPicker';
import PayFooter from '../../components/visibility/PayFooter';
import ActiveSubCard, { computeSubCardProps } from '../../components/visibility/ActiveSubCard';
import StatsGrid from '../../components/visibility/StatsGrid';
import { colors, fonts, radius } from '../../theme';
import { IcoChevron } from '../../components/icons';
import useShopStore from '../../store/shopStore';
import { getProducts } from '../../services/products';
import { StoreProduct } from '../../types/store';
import { formatPrice, formatDateLong } from '../../utils/format';
import {
  PRICE_INCREMENT_PER_EXTRA_PRODUCT,
  FREE_PRODUCTS_THRESHOLD,
} from '../../utils/offreQuartierPricing';
import {
  VisibilityPlan,
  ActiveSub,
  PayMethod,
  WaveOrangeMethod,
  getVisibilityPlans,
  getActiveSub,
  createVisibilityPayment,
  createCreditPurchase,
  verifyVisibilityPayment,
  checkPaymentAvailability,
  getPlanPriceFor,
} from '../../services/visibilityPayment';

// ─── Les trois offres de visibilité ───────────────────────────────────────────

type OfferType = 'quartier' | 'recherche' | 'carte';

const OFFER_ORDER: OfferType[] = ['quartier', 'recherche', 'carte'];

const OFFER_LABELS: Record<OfferType, string> = {
  quartier: 'Offre du quartier',
  recherche: 'Booster ma position dans les recherches',
  carte: 'Apparaître sur la carte en priorité (épingle dorée)',
};

// Forfaits "Booster recherche" et "Épingle dorée" — même tarif pour les deux
// (miroir de _shared/boostPlansPricing.ts, payables avec le crédit LASSI).
const BOOST_PLANS: VisibilityPlan[] = [
  {
    id: '1m',
    label: '1 mois',
    desc: 'Paiement unique',
    price: 500,
    durationMonths: 1,
    durationDays: 30,
    oldPrice: null,
    perLabel: '500 F/mois',
    popular: false,
  },
  {
    id: '3m',
    label: '3 mois',
    desc: 'Économise 500 F',
    price: 1000,
    durationMonths: 3,
    durationDays: 90,
    oldPrice: 1500,
    perLabel: '333 F/mois',
    popular: true,
  },
  {
    id: '6m',
    label: '6 mois',
    desc: 'Économise 500 F',
    price: 2500,
    durationMonths: 6,
    durationDays: 180,
    oldPrice: 3000,
    perLabel: '417 F/mois',
    popular: false,
  },
];

// ─── Sous-composant renouvellement ────────────────────────────────────────────

const IcoArrow = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.accent} />
  </Svg>
);

function RenewCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.renewCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.renewInfo}>
        <Text style={styles.renewTitle}>Renouveler à l'avance</Text>
        <Text style={styles.renewDesc}>Garde ta place sans interruption</Text>
      </View>
      <View style={styles.renewAction}>
        <Text style={styles.renewActionTxt}>Gérer</Text>
        <IcoArrow />
      </View>
    </TouchableOpacity>
  );
}

// ─── Bandeau "paiement Orange Money en attente" ───────────────────────────────

function PendingPaymentBanner({
  onVerify,
  loading,
  qrCode,
  paymentUrl,
}: {
  onVerify: () => void;
  loading: boolean;
  qrCode: string;
  paymentUrl: string;
}) {
  const showQr = !!qrCode && !paymentUrl;  // QR uniquement si deep link indisponible

  return (
    <View style={styles.pendingBanner}>
      {showQr ? (
        <>
          <Text style={styles.pendingTxt}>
            Scanne ce QR code avec l'app Orange Money pour payer.
          </Text>
          <Image
            source={{ uri: `data:image/png;base64,${qrCode}` }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </>
      ) : (
        <Text style={styles.pendingTxt}>
          Paiement Orange Money en attente — reviens ici après avoir payé dans l'app.
        </Text>
      )}
      <TouchableOpacity
        style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
        onPress={onVerify}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.verifyBtnTxt}>
          {loading ? 'Vérification…' : "J'ai payé — vérifier"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Bandeau "forfait activé avec le crédit LASSI" ────────────────────────────

function BoostActivatedBanner({ expiresAt }: { expiresAt: string }) {
  return (
    <View style={styles.activatedBanner}>
      <Text style={styles.activatedTxt}>
        ✅ Forfait activé jusqu'au {formatDateLong(expiresAt)} !
      </Text>
    </View>
  );
}

// ─── Sélecteur d'offre (liste déroulante) ─────────────────────────────────────

const IcoCheck = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polyline points="20 6 9 17 4 12" stroke={colors.accent} />
  </Svg>
);

function OfferPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: OfferType;
  onSelect: (offer: OfferType) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Choisis ton offre</Text>
          {OFFER_ORDER.map((offer, i) => (
            <React.Fragment key={offer}>
              {i > 0 && <View style={styles.modalSep} />}
              <TouchableOpacity
                style={[styles.modalRow, selected === offer && styles.modalRowActive]}
                onPress={() => {
                  onSelect(offer);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalLbl, selected === offer && styles.modalLblActive]}>
                  {OFFER_LABELS[offer]}
                </Text>
                {selected === offer ? <IcoCheck /> : <View style={styles.modalCheckPlaceholder} />}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Types d'état de paiement ─────────────────────────────────────────────────

type PayState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'pending'; subscriptionId: string; paymentUrl: string; qrCode: string }
  | { type: 'verifying' }
  | { type: 'error'; message: string };

type VisibilityView = 'subscribe' | 'subscribed';

interface Props {
  onBack: () => void;
  initialView?: VisibilityView;
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function VisibilityScreen({ onBack, initialView = 'subscribe' }: Props) {
  const shopId = useShopStore(s => s.shopId);
  const creditBalance = useShopStore(s => s.profile?.creditBalance ?? 0);
  const loadMyShop = useShopStore(s => s.loadMyShop);

  const [offerType, setOfferType] = useState<OfferType>('quartier');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<VisibilityView>(initialView);
  const [plans, setPlans] = useState<VisibilityPlan[]>([]);
  const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
  const [selectedId, setSelectedId] = useState('3m');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [featuredAllProducts, setFeaturedAllProducts] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('orange_money');
  const [payState, setPayState] = useState<PayState>({ type: 'idle' });
  const [creditPayLoading, setCreditPayLoading] = useState(false);
  const [boostExpiry, setBoostExpiry] = useState<{ offer: OfferType; expiresAt: string } | null>(
    null,
  );
  const [initLoading, setInitLoading] = useState(true);
  const [keysAvailable, setKeysAvailable] = useState<{
    wave: boolean;
    orange_money: boolean;
  } | null>(null);

  // "Offre du quartier" charge ses forfaits depuis la DB, les deux autres
  // offres utilisent des forfaits fixes (même tarif pour les deux).
  const plansForOffer = offerType === 'quartier' ? plans : BOOST_PLANS;
  const selectedPlan =
    plansForOffer.find(p => p.id === selectedId) ?? plansForOffer[1] ?? plansForOffer[0] ?? null;

  // Pricing dynamique "Offre du quartier" : le tarif de base couvre 1 ou 2
  // produits, chaque produit supplémentaire augmente le prix (cf.
  // offreQuartierPricing.ts). Sans effet sur les autres offres (tarif fixe).
  const nbProduits = featuredAllProducts ? products.length : selectedProductIds.length;
  const withDynamicPrice = (plan: VisibilityPlan): VisibilityPlan =>
    offerType === 'quartier' ? { ...plan, ...getPlanPriceFor(plan, nbProduits) } : plan;

  // ── Changer d'offre depuis la liste déroulante ────────────────────────────
  const selectOffer = (offer: OfferType) => {
    setOfferType(offer);
    setSelectedId('3m');
    setBoostExpiry(null);
    if (offer !== 'quartier') setView('subscribe');
  };

  // ── Chargement initial : plans + abonnement actif ─────────────────────────
  const init = useCallback(async () => {
    setInitLoading(true);
    try {
      const [loadedPlans, sub, keys, loadedProducts] = await Promise.all([
        getVisibilityPlans(),
        shopId ? getActiveSub(shopId) : Promise.resolve(null),
        checkPaymentAvailability(),
        shopId ? getProducts(shopId) : Promise.resolve([]),
      ]);
      setPlans(loadedPlans);
      setKeysAvailable(keys);
      // Méthode par défaut : OM si dispo, sinon Wave, sinon crédit
      if (keys.orange_money) {
        setPayMethod('orange_money');
      } else if (keys.wave) {
        setPayMethod('wave');
      } else {
        setPayMethod('credit');
      }
      setProducts(loadedProducts);
      const defaultProduct = loadedProducts.find(p => p.stock === 'in') ?? loadedProducts[0];
      setSelectedProductIds(defaultProduct ? [defaultProduct.id] : []);
      if (sub) {
        setActiveSub(sub);
        setView('subscribed');
      }
    } catch {
      // Silencieux : la liste de fallback est dans getVisibilityPlans
      setKeysAvailable({ wave: false, orange_money: false });
    } finally {
      setInitLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    init();
  }, [init]);

  // ── Sélection des produits à mettre en avant ──────────────────────────────
  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
  };

  const toggleAllProducts = () => {
    setFeaturedAllProducts(prev => !prev);
  };

  // ── Lancer le paiement (Wave / Orange Money / Crédit LASSI) ─────────────────
  const handlePay = async () => {
    if (!selectedPlan || !shopId) return;

    if (offerType === 'quartier' && !featuredAllProducts && selectedProductIds.length === 0) {
      Alert.alert(
        'Produit requis',
        'Choisis au moins un produit (ou toute ta vitrine) à mettre en avant avant de payer.',
      );
      return;
    }

    // ── Crédit LASSI — activation immédiate ───────────────────────────────────
    if (payMethod === 'credit') {
      await handlePayWithCredit();
      return;
    }

    // ── Wave / Orange Money ───────────────────────────────────────────────────
    setPayState({ type: 'loading' });
    try {
      const result = await createVisibilityPayment({
        planId: selectedPlan.id,
        payMethod: payMethod as WaveOrangeMethod,
        offerType,
        productIds: offerType === 'quartier' ? selectedProductIds : [],
        allProducts: offerType === 'quartier' ? featuredAllProducts : false,
      });

      if (result.status === 'awaiting_keys') {
        setPayState({ type: 'idle' });
        setKeysAvailable(prev => ({
          ...(prev ?? { wave: false, orange_money: false }),
          [payMethod]: false,
        }));
        return;
      }

      setPayState({
        type:           'pending',
        subscriptionId: result.subscriptionId,
        paymentUrl:     result.paymentUrl,
        qrCode:         result.qrCode,
      });

      if (result.paymentUrl) {
        const canOpen = await Linking.canOpenURL(result.paymentUrl);
        if (canOpen) {
          await Linking.openURL(result.paymentUrl);
        } else if (payMethod === 'orange_money' && result.qrCode) {
          // QR code affiché dans le bandeau PendingPaymentBanner
        } else {
          Alert.alert(
            'Application introuvable',
            `Installe ${payMethod === 'wave' ? 'Wave' : 'Orange Money'} pour continuer le paiement.`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      setPayState({ type: 'error', message: msg });
      Alert.alert('Erreur de paiement', msg);
    }
  };

  // ── Vérifier le paiement après retour de l'app Wave/OM ───────────────────
  const handleVerify = async () => {
    if (payState.type !== 'pending') return;
    const { subscriptionId, paymentUrl, qrCode } = payState;

    setPayState({ type: 'verifying' });
    try {
      const result = await verifyVisibilityPayment(subscriptionId);

      if (result.paid) {
        // Recharger l'abonnement depuis la DB pour avoir les vraies données
        const sub = shopId ? await getActiveSub(shopId) : null;
        setActiveSub(sub);
        setPayState({ type: 'idle' });
        setView('subscribed');
      } else if (result.status === 'awaiting_keys') {
        setPayState({ type: 'idle' });
        Alert.alert('Configuration en cours', 'Les clés API ne sont pas encore configurées.');
      } else {
        // Préserver le QR code et le lien pour que le bandeau reste affiché
        setPayState({ type: 'pending', subscriptionId, paymentUrl, qrCode });
        Alert.alert(
          'Paiement non confirmé',
          "Nous n'avons pas encore reçu la confirmation. Réessaie dans quelques secondes.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de vérification';
      setPayState({ type: 'idle' });
      Alert.alert('Erreur', msg);
    }
  };

  // ── Payer avec le crédit LASSI — activation immédiate (3 offres) ──────────
  const handlePayWithCredit = async () => {
    if (!selectedPlan || !shopId) return;

    if (offerType === 'quartier' && !featuredAllProducts && selectedProductIds.length === 0) {
      Alert.alert(
        'Produit requis',
        'Choisis au moins un produit (ou toute ta vitrine) à mettre en avant avant de payer.',
      );
      return;
    }

    setCreditPayLoading(true);
    try {
      const result = await createCreditPurchase({
        offerType,
        planId: selectedPlan.id,
        productIds: offerType === 'quartier' ? selectedProductIds : undefined,
        allProducts: offerType === 'quartier' ? featuredAllProducts : undefined,
      });

      await loadMyShop(); // rafraîchit creditBalance + hasGoldenPin / hasRechercheBoost

      if (offerType === 'quartier') {
        const sub = shopId ? await getActiveSub(shopId) : null;
        setActiveSub(sub);
        setView('subscribed');
      } else {
        setBoostExpiry({ offer: offerType, expiresAt: result.expiresAt });
      }

      Alert.alert(
        'Forfait activé !',
        `Ton crédit LASSI a été utilisé pour activer ce forfait. Il te reste ${formatPrice(result.newBalance)} de crédit.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      Alert.alert('Erreur', msg);
    } finally {
      setCreditPayLoading(false);
    }
  };

  const isPending = payState.type === 'pending';
  const isVerifying = payState.type === 'verifying';
  const isPayLoading = payState.type === 'loading';

  // "Déjà abonné" ne concerne que l'Offre du quartier (seule offre suivie en DB)
  const showSubscribed = offerType === 'quartier' && view === 'subscribed' && activeSub;

  return (
    <View style={styles.root}>
      <VisibilityHeader title="Visibilité" onBack={onBack} />

      {/* Sélecteur d'offre — liste déroulante des 3 offres disponibles */}
      <View style={styles.selectorWrap}>
        <Text style={styles.selectorLabel}>Choisis ton offre</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.82}
        >
          <Text style={styles.selectorTxt} numberOfLines={1}>
            {OFFER_LABELS[offerType]}
          </Text>
          <IcoChevron />
        </TouchableOpacity>
      </View>

      {initLoading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingTxt}>Chargement…</Text>
        </View>
      ) : showSubscribed && activeSub ? (
        // ── Vue "Déjà abonné" ───────────────────────────────────────────────
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ActiveSubCard
            {...computeSubCardProps({
              planLabel: activeSub.planLabel,
              startedAt: activeSub.startedAt,
              expiresAt: activeSub.expiresAt,
            })}
            productName={activeSub.productName}
            productEmoji={activeSub.productEmoji}
            productCount={activeSub.productCount}
            allProducts={activeSub.allProducts}
          />

          <Text style={styles.secLabel}>Ce que ton forfait t'a rapporté</Text>
          <StatsGrid />

          <View style={styles.renewWrap}>
            <RenewCard onPress={() => setView('subscribe')} />
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>
      ) : !selectedPlan ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingTxt}>Chargement…</Text>
        </View>
      ) : (
        // ── Vue "Souscription" ──────────────────────────────────────────────
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <HeroCard variant={offerType} />
            <BenefitsList variant={offerType} />

            {offerType === 'quartier' && (
              <>
                <Text style={styles.secLabel}>Choisis ce que tu veux mettre en avant</Text>
                <ProductPicker
                  products={products}
                  selectedIds={selectedProductIds}
                  allProducts={featuredAllProducts}
                  onToggleProduct={toggleProduct}
                  onToggleAllProducts={toggleAllProducts}
                />
                {nbProduits > FREE_PRODUCTS_THRESHOLD && (
                  <Text style={styles.pricingHint}>
                    +{formatPrice(PRICE_INCREMENT_PER_EXTRA_PRODUCT)} par produit au-delà de{' '}
                    {FREE_PRODUCTS_THRESHOLD} — prix mis à jour ci-dessous.
                  </Text>
                )}
              </>
            )}

            <Text style={styles.secLabel}>Choisis ton forfait</Text>
            {plansForOffer.map(plan => (
              <PlanCard
                key={plan.id}
                plan={withDynamicPrice(plan)}
                selected={plan.id === selectedId}
                onSelect={() => setSelectedId(plan.id)}
              />
            ))}

            {/* Bandeau affiché quand un paiement Wave/OM est en attente */}
            {isPending && payState.type === 'pending' && (
              <View style={styles.bannerWrap}>
                <PendingPaymentBanner
                  onVerify={handleVerify}
                  loading={isVerifying}
                  qrCode={payState.qrCode}
                  paymentUrl={payState.paymentUrl}
                />
              </View>
            )}

            {/* Confirmation après achat avec le crédit LASSI (recherche / carte) */}
            {offerType !== 'quartier' && boostExpiry?.offer === offerType && (
              <View style={styles.bannerWrap}>
                <BoostActivatedBanner expiresAt={boostExpiry.expiresAt} />
              </View>
            )}

            <View style={{ height: 14 }} />
          </ScrollView>

          {/* Footer : OM / Wave / Crédit LASSI */}
          {!isPending && !isVerifying && (
            <PayFooter
              plan={withDynamicPrice(selectedPlan)}
              payMethod={payMethod}
              onMethodChange={setPayMethod}
              onPay={handlePay}
              loading={isPayLoading || creditPayLoading}
              keysAvailable={keysAvailable ?? undefined}
              creditBalance={creditBalance}
            />
          )}
        </>
      )}

      <OfferPickerModal
        visible={pickerOpen}
        selected={offerType}
        onSelect={selectOffer}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },

  // Sélecteur d'offre
  selectorWrap: { paddingHorizontal: 18, marginBottom: 16 },
  selectorLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorTxt: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },

  // Modal sélecteur d'offre
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  modalTitle: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  modalSep: {
    height: 1,
    backgroundColor: colors.border,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  modalRowActive: {
    backgroundColor: 'rgba(253,207,52,0.06)',
  },
  modalLbl: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  modalLblActive: {
    color: colors.accent,
  },
  modalCheckPlaceholder: {
    width: 16,
    height: 16,
  },

  secLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  pricingHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    paddingHorizontal: 18,
    marginTop: -4,
    marginBottom: 14,
  },

  renewWrap: { paddingHorizontal: 18 },
  renewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: 16,
  },
  renewInfo: { flex: 1 },
  renewTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  renewDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  renewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  renewActionTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Bandeau paiement en attente
  bannerWrap: { paddingHorizontal: 18, marginTop: 4 },
  pendingBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
  },
  pendingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 10,
  },
  qrImage: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  activatedBanner: {
    backgroundColor: 'rgba(253,207,52,.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
  },
  activatedTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
    textAlign: 'center',
  },
  verifyBtn: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Chargement initial
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
