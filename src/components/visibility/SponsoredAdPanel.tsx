import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WAVE_ENABLED } from '../../config/features';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
  findNodeHandle,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import AdFormatPicker from './AdFormatPicker';
import AdPackSelector, { AdPackSelection } from './AdPackSelector';
import AdContentForm, { AdContent } from './AdContentForm';
import {
  AdFormat,
  AdPack,
  SponsoredAd,
  AD_PACKS,
  getAdPacks,
  creerAnnonceSponsorisee,
  getMerchantAds,
  formatDuration,
  creditsToFcfa,
  formatFcfa,
} from '../../services/sponsoredAds';
import { formatPrice, formatDateLong } from '../../utils/format';
import useShopStore from '../../store/shopStore';
import {
  PayMethod,
  checkPaymentAvailability,
  createVisibilityPayment,
  verifyVisibilityPayment,
} from '../../services/visibilityPayment';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoMega = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11v2M18 8c1.5.8 2.5 2.3 2.5 4s-1 3.2-2.5 4" stroke={colors.bg} />
    <Path d="M5 11v2h3l6 4V7l-6 4H5z" stroke={colors.bg} />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17 4 12" stroke={colors.bg} />
  </Svg>
);

const IcoWave = ({ active }: { active: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke={active ? colors.bg : colors.muted} />
    <Circle cx={12} cy={12} r={3} stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

const IcoLock = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" stroke={colors.muted} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.muted} />
  </Svg>
);

const IcoRefresh = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 4v6h6M23 20v-6h-6" stroke={colors.accent} />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke={colors.accent} />
  </Svg>
);

const IcoDot = ({ color }: { color: string }) => (
  <Svg width={6} height={6} viewBox="0 0 6 6">
    <Circle cx={3} cy={3} r={3} fill={color} />
  </Svg>
);

// ─── Badge statut ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SponsoredAd['status'] }) {
  const map = {
    active:    { label: 'En cours',  color: colors.success },
    completed: { label: 'Terminée',  color: colors.muted },
    cancelled: { label: 'Annulée',   color: colors.danger },
  };
  const { label, color } = map[status];
  return (
    <View style={[adS.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <IcoDot color={color} />
      <Text style={[adS.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Carte résultat (côté prestataire) ────────────────────────────────────────

function MyAdCard({ ad }: { ad: SponsoredAd }) {
  const pct = Math.min(100, Math.round((ad.actualViews / Math.max(ad.estMax, 1)) * 100));
  const timeLeft = (() => {
    if (ad.status !== 'active') return null;
    const ms = new Date(ad.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expirée';
    const h = Math.floor(ms / 3_600_000);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}j ${h % 24}h restants`;
    return `${h}h restantes`;
  })();

  return (
    <View style={adS.card}>
      {/* En-tête */}
      <View style={adS.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={adS.cardTitle} numberOfLines={1}>
            {ad.titre ?? (ad.format === 'affiche' ? 'Affiche' : 'Annonce')}
          </Text>
          <Text style={adS.cardSub}>
            {ad.budgetCredits} crédits · {formatDuration(ad.durationHours)}
          </Text>
        </View>
        <StatusBadge status={ad.status} />
      </View>

      {/* Métriques : vues + contacts côte à côte */}
      <View style={adS.metricsRow}>
        <View style={adS.metricBox}>
          <Text style={adS.metricCount}>{ad.actualViews.toLocaleString('fr-SN')}</Text>
          <Text style={adS.metricLabel}>vues</Text>
        </View>
        <View style={adS.metricDivider} />
        <View style={adS.metricBox}>
          <Text style={[adS.metricCount, { color: colors.success }]}>
            {(ad.contactCount ?? 0).toLocaleString('fr-SN')}
          </Text>
          <Text style={adS.metricLabel}>contacts</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={adS.progressSection}>
        <View style={adS.progressRow}>
          <Text style={adS.progressPct}>{pct}%</Text>
          <Text style={adS.progressGoal}>
            objectif {ad.estMin.toLocaleString()}–{ad.estMax.toLocaleString()} vues
          </Text>
        </View>
        <View style={adS.progressWrap}>
          <View style={[adS.progressBar, { width: `${pct}%` }]} />
        </View>
      </View>

      {/* Pied de carte */}
      <View style={adS.cardFooter}>
        {timeLeft ? (
          <Text style={adS.footerTxt}>⏳ {timeLeft}</Text>
        ) : (
          <Text style={adS.footerTxt}>Terminée le {formatDateLong(ad.expiresAt)}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  onCreated?: (newBalance: number) => void;
}

export default function SponsoredAdPanel({ onCreated }: Props) {
  const shopId        = useShopStore(s => s.shopId);
  const creditBalance = useShopStore(s => s.profile?.creditBalance ?? 0);
  const loadMyShop    = useShopStore(s => s.loadMyShop);

  const [adPacks, setAdPacks] = useState<AdPack[]>(AD_PACKS);

  const [format, setFormat]       = useState<AdFormat>('classique');
  const [content, setContent]     = useState<AdContent>({
    titre: '', corps: '', imageUri: null, imageUrl: null,
  });
  const [selection, setSelection] = useState<AdPackSelection>({
    mode: 'pack', pack: AD_PACKS.find(p => p.popular) ?? AD_PACKS[1],
  });
  const [uploading, setUploading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [myAds, setMyAds]         = useState<SponsoredAd[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef   = useRef<ScrollView>(null);

  const loadAds = useCallback(async (silent = false) => {
    if (!shopId) return;
    if (!silent) setLoadingAds(true);
    try {
      const ads = await getMerchantAds(shopId);
      setMyAds(ads);
    } finally {
      if (!silent) setLoadingAds(false);
    }
  }, [shopId]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAds(true);
    setRefreshing(false);
  }, [loadAds]);

  useEffect(() => { loadAds(); }, [loadAds]);

  useEffect(() => {
    getAdPacks().then(packs => {
      setAdPacks(packs);
      const def = packs.find(p => p.popular) ?? packs[1] ?? packs[0];
      if (def) setSelection({ mode: 'pack', pack: def });
    }).catch(() => {});
  }, []);

  // Auto-refresh toutes les 60s tant qu'une campagne est active
  useEffect(() => {
    const hasActive = myAds.some(a => a.status === 'active');
    if (!hasActive) return;
    const id = setInterval(() => { void loadAds(true); }, 60_000);
    return () => clearInterval(id);
  }, [myAds, loadAds]);

  // Résumé budget/durée/estimations selon la sélection courante
  const budget   = selection.mode === 'pack' ? selection.pack.budgetCredits : selection.budgetCredits;
  const duration = selection.mode === 'pack' ? selection.pack.durationHours : selection.durationHours;
  const estMin   = selection.mode === 'pack' ? selection.pack.estMin : selection.estMin;
  const estMax   = selection.mode === 'pack' ? selection.pack.estMax : selection.estMax;
  const fcfaPrice = creditsToFcfa(budget);
  const hasEnough = creditBalance >= budget;

  // ── Méthode de paiement ──────────────────────────────────────────────────────
  const [payMethod, setPayMethod]     = useState<PayMethod>('credit');
  const [keysAvailable, setKeysAvailable] = useState<{ wave: boolean; orange_money: boolean } | null>(null);
  // État paiement Wave/OM en attente
  type PendingPay = { subscriptionId: string; paymentUrl: string; qrCode: string } | null;
  const [pendingPay, setPendingPay]   = useState<PendingPay>(null);
  const [verifying, setVerifying]     = useState(false);

  useEffect(() => {
    checkPaymentAvailability().then(setKeysAvailable).catch(() => {});
  }, []);

  const validate = (): string | null => {
    if (format === 'classique') {
      if (!content.titre.trim()) return 'Le titre est requis.';
      if (!content.corps.trim()) return 'La description est requise.';
    } else {
      if (!content.imageUrl) return "L'image est requise pour une Affiche.";
    }
    if (uploading) return "Attends la fin de l'upload avant de lancer.";
    if (payMethod === 'credit' && !hasEnough)
      return `Crédit insuffisant — il te manque ${budget - creditBalance} crédits.`;
    return null;
  };

  // ── Lancement par crédit LASSI ────────────────────────────────────────────────
  const launchWithCredit = async () => {
    if (!shopId) return;
    setLaunching(true);
    try {
      const result = await creerAnnonceSponsorisee({
        shopId,
        format,
        titre:         format === 'classique' ? content.titre : undefined,
        corps:         format === 'classique' ? content.corps : undefined,
        imageUrl:      content.imageUrl ?? undefined,
        budgetCredits: budget,
        durationHours: duration,
        estMin,
        estMax,
      });
      await loadMyShop();
      await loadAds();
      setContent({ titre: '', corps: '', imageUri: null, imageUrl: null });
      onCreated?.(result.newBalance);
      Alert.alert(
        'Campagne lancée',
        `Ton annonce est en ligne.\nNouveau solde : ${result.newBalance} crédits.`,
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLaunching(false);
    }
  };

  // ── Lancement par Wave / Orange Money ────────────────────────────────────────
  const launchWithWaveOrOM = async () => {
    if (!shopId) return;
    setLaunching(true);
    try {
      const result = await createVisibilityPayment({
        planId:     `ad_${budget}cr`,
        payMethod,
        offerType:  'annonce',
        productIds: [],
        allProducts: false,
        adMetadata: {
          format,
          titre:         format === 'classique' ? content.titre : null,
          corps:         format === 'classique' ? content.corps : null,
          imageUrl:      content.imageUrl ?? null,
          durationHours: duration,
          estMin,
          estMax,
        },
      });

      if (result.status === 'awaiting_keys') {
        Alert.alert(
          'Bientôt disponible',
          `Le paiement par ${payMethod === 'wave' ? 'Wave' : 'Orange Money'} sera disponible prochainement.`,
        );
        return;
      }

      setPendingPay({
        subscriptionId: result.subscriptionId,
        paymentUrl:     result.paymentUrl,
        qrCode:         result.qrCode,
      });

      // Ouvrir l'app OM directement — canOpenURL bloque sur Android 11+ pour schemes custom
      if (result.paymentUrl) {
        Linking.openURL(result.paymentUrl).catch(() => {
          // Silencieux : le QR sert de fallback
        });
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLaunching(false);
    }
  };

  const handleLaunch = () => {
    const err = validate();
    if (err) { Alert.alert('Annonce incomplète', err); return; }
    if (payMethod === 'credit') {
      void launchWithCredit();
    } else {
      void launchWithWaveOrOM();
    }
  };

  const handleVerifyPay = async () => {
    if (!pendingPay) return;
    setVerifying(true);
    try {
      const result = await verifyVisibilityPayment(pendingPay.subscriptionId);
      if (result.paid) {
        setPendingPay(null);
        await loadAds();
        setContent({ titre: '', corps: '', imageUri: null, imageUrl: null });
        Alert.alert(
          'Campagne lancée',
          'Ton paiement a été confirmé et ton annonce est maintenant en ligne.',
        );
      } else {
        Alert.alert(
          'Paiement non confirmé',
          'On n\'a pas encore reçu la confirmation Orange Money. Patiente 1-2 min et réessaie.',
        );
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de vérifier le paiement.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >

      {/* Section : nouvelle campagne */}
      <Text style={[s.secLabel, s.secLabelStandalone]}>Créer une nouvelle annonce</Text>

      {/* Format */}
      <Text style={s.fieldLabel}>Format d'affichage</Text>
      <AdFormatPicker selected={format} onSelect={f => {
        setFormat(f);
        setContent({ titre: '', corps: '', imageUri: null, imageUrl: null });
      }} />

      {/* Contenu */}
      <Text style={s.fieldLabel}>Contenu de l'annonce</Text>
      <AdContentForm
        format={format}
        content={content}
        onChange={setContent}
        uploading={uploading}
        onSetUploading={setUploading}
        shopId={shopId ?? ''}
        scrollViewRef={scrollRef as React.RefObject<ScrollView | null>}
      />

      {/* Pack / Budget */}
      <Text style={s.fieldLabel}>Budget & durée</Text>
      <AdPackSelector selection={selection} onChange={setSelection} packs={adPacks} />

      {/* Récapitulatif */}
      <View style={s.summary}>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Portée estimée</Text>
          <Text style={s.summaryVal}>{estMin.toLocaleString()}–{estMax.toLocaleString()} vues</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Durée</Text>
          <Text style={s.summaryVal}>{formatDuration(duration)}</Text>
        </View>
        <View style={[s.summaryRow, s.summaryRowHighlight]}>
          <Text style={s.summaryKey}>Coût</Text>
          <Text style={s.summaryVal}>{formatFcfa(fcfaPrice)}</Text>
        </View>
        {payMethod === 'credit' && (
          <View style={s.summaryRow}>
            <Text style={s.summaryKey}>Ton solde crédit</Text>
            <Text style={[s.summaryVal, !hasEnough && { color: colors.danger }]}>
              {formatFcfa(creditBalance)}
            </Text>
          </View>
        )}
      </View>

      {/* Sélecteur de paiement */}
      <Text style={s.payLabel}>Mode de paiement</Text>
      <View style={s.payMethods}>

        {/* Crédit LASSI */}
        <TouchableOpacity
          style={[s.payRow, payMethod === 'credit' && s.payRowActive]}
          onPress={() => setPayMethod('credit')}
          activeOpacity={0.8}
        >
          <View style={[s.payRadio, payMethod === 'credit' && s.payRadioActive]}>
            {payMethod === 'credit' && <IcoCheck />}
          </View>
          <View style={s.payInfo}>
            <Text style={[s.payName, payMethod === 'credit' && s.payNameActive]}>
              Crédit LASSI
            </Text>
            <Text style={s.payDesc}>Déduction immédiate de ton solde</Text>
          </View>
          <Text style={[s.payPrice, payMethod === 'credit' && s.payPriceActive]}>
            {formatFcfa(fcfaPrice)}
          </Text>
        </TouchableOpacity>

        {/* Wave — masqué jusqu'à IP statique Supabase Pro */}
        {WAVE_ENABLED && (
          <TouchableOpacity
            style={[
              s.payRow,
              payMethod === 'wave' && s.payRowActive,
              !keysAvailable?.wave && s.payRowDisabled,
            ]}
            onPress={() => keysAvailable?.wave && setPayMethod('wave')}
            activeOpacity={keysAvailable?.wave ? 0.8 : 1}
          >
            <View style={[s.payRadio, payMethod === 'wave' && s.payRadioActive]}>
              {payMethod === 'wave' ? <IcoCheck /> : !keysAvailable?.wave ? <IcoLock /> : null}
            </View>
            <View style={s.payInfo}>
              <Text style={[s.payName, payMethod === 'wave' && s.payNameActive]}>
                Wave
              </Text>
              <Text style={s.payDesc}>
                {keysAvailable?.wave ? 'Paiement mobile sécurisé' : 'Bientôt disponible'}
              </Text>
            </View>
            <Text style={[s.payPrice, payMethod === 'wave' && s.payPriceActive]}>
              {formatFcfa(fcfaPrice)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Orange Money */}
        <TouchableOpacity
          style={[
            s.payRow,
            payMethod === 'orange_money' && s.payRowActive,
            !keysAvailable?.orange_money && s.payRowDisabled,
          ]}
          onPress={() => keysAvailable?.orange_money && setPayMethod('orange_money')}
          activeOpacity={keysAvailable?.orange_money ? 0.8 : 1}
        >
          <View style={[s.payRadio, payMethod === 'orange_money' && s.payRadioActive]}>
            {payMethod === 'orange_money' ? <IcoCheck /> : !keysAvailable?.orange_money ? <IcoLock /> : null}
          </View>
          <View style={s.payInfo}>
            <Text style={[s.payName, payMethod === 'orange_money' && s.payNameActive]}>
              Orange Money
            </Text>
            <Text style={s.payDesc}>
              {keysAvailable?.orange_money ? 'Paiement mobile sécurisé' : 'Bientôt disponible'}
            </Text>
          </View>
          <Text style={[s.payPrice, payMethod === 'orange_money' && s.payPriceActive]}>
            {formatFcfa(fcfaPrice)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bandeau paiement Wave/OM en attente */}
      {pendingPay ? (
        <View style={s.pendingBanner}>
          {/* Bouton rouvrir app OM */}
          {!!pendingPay.paymentUrl && (
            <TouchableOpacity
              style={s.omBtn}
              onPress={() => Linking.openURL(pendingPay.paymentUrl).catch(() => {})}
              activeOpacity={0.85}
            >
              <Text style={s.omBtnTxt}>Ouvrir Orange Money</Text>
            </TouchableOpacity>
          )}
          {/* QR code — affiché toujours si disponible */}
          {!!pendingPay.qrCode ? (
            <>
              <Text style={s.pendingTxt}>
                {pendingPay.paymentUrl
                  ? 'Ou scanne ce QR code avec l\'app Orange Money.'
                  : 'Scanne ce QR code avec l\'app Orange Money pour payer.'}
              </Text>
              <Image source={{ uri: `data:image/png;base64,${pendingPay.qrCode}` }} style={s.qrImage} resizeMode="contain" />
            </>
          ) : (
            <Text style={s.pendingTxt}>
              Paiement en attente — reviens ici après avoir payé dans l'app.
            </Text>
          )}
          <TouchableOpacity
            style={[s.verifyBtn, verifying && { opacity: 0.6 }]}
            onPress={handleVerifyPay}
            disabled={verifying}
            activeOpacity={0.8}
          >
            <Text style={s.verifyBtnTxt}>{verifying ? 'Vérification…' : 'J\'ai payé — vérifier'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bouton lancer */}
      <TouchableOpacity
        style={[
          s.cta,
          (uploading || launching || !!pendingPay) && s.ctaDisabled,
          payMethod === 'credit' && !hasEnough && s.ctaDisabled,
        ]}
        onPress={handleLaunch}
        disabled={uploading || launching || !!pendingPay || (payMethod === 'credit' && !hasEnough)}
        activeOpacity={0.85}
      >
        {launching ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <>
            <IcoMega />
            <Text style={s.ctaTxt}>Lancer la campagne</Text>
          </>
        )}
      </TouchableOpacity>

      {payMethod === 'credit' && !hasEnough && (
        <Text style={s.noFundsHint}>
          Crédit insuffisant — recharge via le menu "Obtenir des crédits".
        </Text>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 4 },

  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    marginTop: 4,
  },
  secLabel: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  secLabelStandalone: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    marginTop: 4,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  refreshTxt: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  fieldLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    paddingHorizontal: 18,
    paddingBottom: 12,
    marginTop: 2,
  },

  adsWrap: { marginHorizontal: 18, gap: 10, marginBottom: 24 },

  summary: {
    marginHorizontal: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryKey: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  summaryVal: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 18,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  noFundsHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 18,
  },

  // Récap prix FCFA
  summaryRowHighlight: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  summaryFcfa: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  // Sélecteur paiement
  payLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    paddingHorizontal: 18,
    paddingBottom: 10,
    marginTop: 2,
  },
  payMethods: {
    marginHorizontal: 18,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payRowActive: {
    backgroundColor: 'rgba(253,207,52,.06)',
  },
  payRowDisabled: {
    opacity: 0.5,
  },
  payRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  payRadioActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  payInfo: { flex: 1 },
  payName: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13.5,
    marginBottom: 2,
  },
  payNameActive: { color: colors.white },
  payDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  payPrice: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  payPriceActive: { color: colors.accent },

  // Bandeau Wave/OM en attente
  pendingBanner: {
    marginHorizontal: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    marginBottom: 14,
  },
  pendingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  omBtn: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  omBtnTxt: {
    color: '#fff',
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  qrImage: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  verifyBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
});

const adS = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '30',
    borderRadius: radius.lg,
    padding: 16,
    overflow: 'hidden',
  },

  // En-tête
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 2,
  },
  cardSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  // Badge statut
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeTxt: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Métriques vues + contacts
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    marginBottom: 16,
    overflow: 'hidden',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  metricCount: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 32,
    lineHeight: 38,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  // Barre de progression
  progressSection: {
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPct: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  progressGoal: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  progressWrap: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },

  // Pied de carte
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  footerTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
