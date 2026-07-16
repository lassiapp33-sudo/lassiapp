import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import AdFormatPicker from './AdFormatPicker';
import AdPackSelector, { AdPackSelection } from './AdPackSelector';
import AdContentForm, { AdContent } from './AdContentForm';
import {
  AdFormat,
  SponsoredAd,
  AD_PACKS,
  creerAnnonceSponsorisee,
  getMerchantAds,
  formatDuration,
} from '../../services/sponsoredAds';
import { formatPrice, formatDateLong } from '../../utils/format';
import useShopStore from '../../store/shopStore';

// ─── Icône méga-phone ─────────────────────────────────────────────────────────

const IcoMega = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11v2M18 8c1.5.8 2.5 2.3 2.5 4s-1 3.2-2.5 4" stroke={colors.accent} />
    <Path d="M5 11v2h3l6 4V7l-6 4H5z" stroke={colors.accent} />
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
      <Text style={[adS.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Carte d'annonce active (côté prestataire) ────────────────────────────────

function MyAdCard({ ad }: { ad: SponsoredAd }) {
  return (
    <View style={adS.card}>
      <View style={adS.cardHeader}>
        <Text style={adS.cardTitle} numberOfLines={1}>
          {ad.titre ?? (ad.format === 'affiche' ? 'Affiche' : 'Annonce')}
        </Text>
        <StatusBadge status={ad.status} />
      </View>
      <View style={adS.cardRow}>
        <Text style={adS.cardMeta}>
          {ad.budgetCredits} crédits · {formatDuration(ad.durationHours)}
        </Text>
      </View>
      <View style={adS.cardRow}>
        <Text style={adS.cardMeta}>
          {ad.actualViews} vues · expire {formatDateLong(ad.expiresAt)}
        </Text>
      </View>
      <View style={adS.progressWrap}>
        <View
          style={[
            adS.progressBar,
            {
              width: `${Math.min(100, (ad.actualViews / Math.max(ad.estMax, 1)) * 100)}%`,
            },
          ]}
        />
      </View>
      <Text style={adS.progressHint}>
        Objectif : {ad.estMin.toLocaleString()}–{ad.estMax.toLocaleString()} vues
      </Text>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  onCreated?: (newBalance: number) => void;
}

const DEFAULT_PACK = AD_PACKS.find(p => p.popular) ?? AD_PACKS[1];

export default function SponsoredAdPanel({ onCreated }: Props) {
  const shopId        = useShopStore(s => s.shopId);
  const creditBalance = useShopStore(s => s.profile?.creditBalance ?? 0);
  const loadMyShop    = useShopStore(s => s.loadMyShop);

  const [format, setFormat]       = useState<AdFormat>('classique');
  const [content, setContent]     = useState<AdContent>({
    titre: '', corps: '', imageUri: null, imageUrl: null,
  });
  const [selection, setSelection] = useState<AdPackSelection>({
    mode: 'pack', pack: DEFAULT_PACK,
  });
  const [uploading, setUploading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [myAds, setMyAds]         = useState<SponsoredAd[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);

  const loadAds = useCallback(async () => {
    if (!shopId) return;
    setLoadingAds(true);
    try {
      const ads = await getMerchantAds(shopId);
      setMyAds(ads);
    } finally {
      setLoadingAds(false);
    }
  }, [shopId]);

  useEffect(() => { loadAds(); }, [loadAds]);

  // Résumé budget/durée/estimations selon la sélection courante
  const budget = selection.mode === 'pack' ? selection.pack.budgetCredits : selection.budgetCredits;
  const duration = selection.mode === 'pack' ? selection.pack.durationHours : selection.durationHours;
  const estMin = selection.mode === 'pack' ? selection.pack.estMin : selection.estMin;
  const estMax = selection.mode === 'pack' ? selection.pack.estMax : selection.estMax;
  const hasEnough = creditBalance >= budget;

  const validate = (): string | null => {
    if (format === 'classique') {
      if (!content.titre.trim()) return 'Le titre est requis.';
      if (!content.corps.trim()) return 'La description est requise.';
    } else {
      if (!content.imageUrl) return "L'image est requise pour une Affiche.";
    }
    if (uploading) return "Attends la fin de l'upload avant de lancer.";
    if (!hasEnough) return `Crédit insuffisant — il te manque ${formatPrice(budget - creditBalance)}.`;
    return null;
  };

  const handleLaunch = async () => {
    const err = validate();
    if (err) { Alert.alert('Annonce incomplète', err); return; }
    if (!shopId) return;

    Alert.alert(
      'Lancer la campagne ?',
      `${budget} crédits seront débités de ton solde.\nDurée : ${formatDuration(duration)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          style: 'default',
          onPress: async () => {
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
              await loadMyShop(); // rafraîchit creditBalance
              await loadAds();
              setContent({ titre: '', corps: '', imageUri: null, imageUrl: null });
              onCreated?.(result.newBalance);
              Alert.alert(
                '🚀 Campagne lancée !',
                `Ton annonce est en ligne. Nouveau solde : ${formatPrice(result.newBalance)} crédits.`,
              );
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inattendue');
            } finally {
              setLaunching(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Section : mes campagnes actives */}
      {(myAds.length > 0 || loadingAds) && (
        <>
          <Text style={s.secLabel}>Mes campagnes</Text>
          {loadingAds ? (
            <ActivityIndicator color={colors.accent} style={{ marginBottom: 22 }} />
          ) : (
            <View style={s.adsWrap}>
              {myAds.slice(0, 3).map(ad => <MyAdCard key={ad.id} ad={ad} />)}
            </View>
          )}
        </>
      )}

      {/* Section : nouvelle campagne */}
      <Text style={s.secLabel}>Créer une nouvelle annonce</Text>

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
      />

      {/* Pack / Budget */}
      <Text style={s.fieldLabel}>Budget & durée</Text>
      <AdPackSelector selection={selection} onChange={setSelection} />

      {/* Récapitulatif + CTA */}
      <View style={s.summary}>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Portée estimée</Text>
          <Text style={s.summaryVal}>
            {estMin.toLocaleString()}–{estMax.toLocaleString()} vues
          </Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Durée</Text>
          <Text style={s.summaryVal}>{formatDuration(duration)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Coût</Text>
          <Text style={[s.summaryVal, !hasEnough && { color: colors.danger }]}>
            {budget} crédits
          </Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Ton solde</Text>
          <Text style={[s.summaryVal, !hasEnough && { color: colors.danger }]}>
            {creditBalance} crédits
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[s.cta, (!hasEnough || uploading || launching) && s.ctaDisabled]}
        onPress={handleLaunch}
        disabled={!hasEnough || uploading || launching}
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

      {!hasEnough && (
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

  secLabel: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
    paddingHorizontal: 18,
    paddingBottom: 14,
    marginTop: 4,
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
});

const adS = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginRight: 8,
  },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  cardRow: { marginBottom: 2 },
  cardMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  progressWrap: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
});
