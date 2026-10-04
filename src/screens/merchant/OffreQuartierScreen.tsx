import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice, formatDateLong } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
import { getProducts } from '../../services/products';
import { getTerrainsByMerchant } from '../../services/terrains';
import { getMesOffres, FitnessOffre } from '../../services/fitnessAbonnements';
import { getBeautyServices } from '../../services/beauty';
import { BeautyService } from '../../types/beauty';
import { StoreProduct } from '../../types/store';
import { Terrain, SPORT_EMOJI } from '../../types/terrain';
import {
  getMonCarrouselQuota,
  getMesProduitsCarrousel,
  setCarrouselSelection,
  RecompenseAttribuee,
} from '../../services/classementService';
import { getActiveSubs, updateSubProducts, ActiveSub } from '../../services/visibilityPayment';
import { getErrorMessage, notifyError } from '../../utils/errorUtils';
import { getActivePromos, buildProductPromoMap, calcPromoClientPrice } from '../../services/promotions';
import { Promotion, ProductPromoInfo } from '../../types/promotions';
import OffreQuartierPreviewModal, { PreviewItem } from '../../components/merchant/OffreQuartierPreviewModal';

const TERRAIN_SPORTS_ELIGIBLES = ['football', 'basketball'] as const;

interface EligibleItem {
  kind: 'product' | 'terrain' | 'abonnement' | 'beaute';
  id: string;
  nom: string;
  prix: number;
  image: string;
  prixPromo?: number;
  promoBadge?: string;
}

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IcoEye = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={colors.accent} />
    <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={colors.accent} />
  </Svg>
);

function formatDaysRemaining(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const days = Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000));
  if (days === 0) return "Expire aujourd'hui";
  if (days === 1) return 'Expire demain';
  if (days <= 30) return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  return `${months} mois restant${months > 1 ? 's' : ''}`;
}

interface ProductListProps {
  items: EligibleItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  quotaN: number;
}

function ProductList({ items, selectedIds, onToggle, quotaN }: ProductListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyProducts}>
        <Text style={styles.emptyTxt}>
          Ajoute un produit en stock (avec photo ou emoji) à ta vitrine pour pouvoir le mettre en avant ici.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {items.map(item => {
        const selected = selectedIds.includes(item.id);
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, selected && styles.cardSel]}
            onPress={() => onToggle(item.id)}
            activeOpacity={0.82}
          >
            <View style={[styles.checkbox, selected && styles.checkboxSel]}>
              {selected && <IcoCheck />}
            </View>
            {item.image.startsWith('http') ? (
              <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
            ) : (
              <View style={[styles.img, styles.emojiBox]}>
                <Text style={styles.emojiTxt}>{item.image}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.nom}</Text>
              <View style={styles.priceRow}>
                {item.prixPromo != null ? (
                  <>
                    <Text style={styles.priceOld}>{formatPrice(item.prix)}</Text>
                    <Text style={styles.price}>{formatPrice(item.prixPromo)}</Text>
                  </>
                ) : (
                  <Text style={styles.price}>{formatPrice(item.prix)}</Text>
                )}
                {item.promoBadge != null && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeTxt}>{item.promoBadge}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface Props {
  onBack: () => void;
}

export default function OffreQuartierScreen({ onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const shopId = useShopStore(s => s.shopId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSubId, setSavingSubId] = useState<string | null>(null);
  const [quota, setQuota] = useState<RecompenseAttribuee | null>(null);
  // Forfaits quartier CUMULABLES : tous les forfaits actifs, chacun éditable.
  const [paidSubs, setPaidSubs] = useState<ActiveSub[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [abonnements, setAbonnements] = useState<FitnessOffre[]>([]);
  const [beautyServices, setBeautyServices] = useState<BeautyService[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Sélection de produits par forfait (clé = subscription id).
  const [paidSelBySub, setPaidSelBySub] = useState<Record<string, string[]>>({});
  const [promoMap, setPromoMap] = useState<Record<string, ProductPromoInfo>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [teaserOpen, setTeaserOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !shopId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [reward, mine, allProducts, myTerrains, myAbonnements, myBeauty, subs, activePromos] = await Promise.all([
        getMonCarrouselQuota(userId),
        getMesProduitsCarrousel(userId),
        getProducts(shopId),
        getTerrainsByMerchant(userId),
        getMesOffres(userId),
        getBeautyServices(userId).catch(() => []),
        getActiveSubs(shopId),
        getActivePromos(shopId),
      ]);
      setQuota(reward);
      const quartierSubs = subs.filter(s => s.offerType === 'quartier');
      setPaidSubs(quartierSubs);
      const initSel: Record<string, string[]> = {};
      quartierSubs.forEach(s => {
        initSel[s.id] = s.allProducts ? [] : (s.productIds ?? (s.productId ? [s.productId] : []));
      });
      setPaidSelBySub(initSel);
      setProducts(allProducts);
      setPromoMap(buildProductPromoMap(activePromos));
      setAbonnements(myAbonnements.filter(a => a.actif));
      setBeautyServices(myBeauty);
      setTerrains(
        myTerrains.filter(
          t => t.actif && (TERRAIN_SPORTS_ELIGIBLES as readonly string[]).includes(t.sport_type),
        ),
      );
      const maxProduits = reward?.carrousel_produits ?? 0;
      setSelectedIds(
        mine
          .map(item => item.product_id ?? item.terrain_id ?? item.beauty_service_id)
          .filter((id): id is string => !!id)
          .slice(0, maxProduits),
      );
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger ton "Offre du Quartier"'));
    } finally {
      setLoading(false);
    }
  }, [userId, shopId]);

  useEffect(() => { load(); }, [load]);

  const quotaN = quota?.carrousel_produits ?? 0;
  // Nombre de produits autorisés pour un forfait donné.
  const paidQuotaFor = (sub: ActiveSub) =>
    sub.allProducts ? paidEligibleItems.length : sub.productCount;

  // Produits + terrains éligibles (section admin)
  const eligibleItems: EligibleItem[] = [
    ...products
      .filter(p => (p.photoUrl || p.emoji) && p.stock === 'in')
      .map(p => {
        const promoInfo = promoMap[p.id];
        const prixPromo = promoInfo ? (calcPromoClientPrice(p.price, promoInfo) ?? undefined) : undefined;
        return {
          kind: 'product' as const,
          id: p.id,
          nom: p.name,
          prix: calculerPrixClient(p.price),
          image: p.photoUrl || p.emoji,
          prixPromo,
          promoBadge: promoInfo?.badge,
        };
      }),
    ...terrains.map(t => ({
      kind: 'terrain' as const,
      id: t.id,
      nom: t.nom,
      prix: calculerPrixClient(t.prix_horaire),
      image: SPORT_EMOJI[t.sport_type],
    })),
    ...beautyServices.map(s => ({
      kind: 'beaute' as const,
      id: s.id,
      nom: s.nom,
      prix: calculerPrixClient(s.prix),
      image: '💈',
    })),
  ];

  // Produits, abonnements fitness, terrains et services beauté (section payante)
  const paidEligibleItems: EligibleItem[] = [
    ...products
      .filter(p => p.stock === 'in')
      .map(p => {
        const promoInfo = promoMap[p.id];
        const prixPromo = promoInfo ? (calcPromoClientPrice(p.price, promoInfo) ?? undefined) : undefined;
        return {
          kind: 'product' as const,
          id: p.id,
          nom: p.name,
          prix: calculerPrixClient(p.price),
          image: p.photoUrl || p.emoji || '🛍️',
          prixPromo,
          promoBadge: promoInfo?.badge,
        };
      }),
    ...abonnements.map(a => ({
      kind: 'abonnement' as const,
      id: a.id,
      nom: a.nom,
      prix: a.prix,
      image: '🏋️',
    })),
    ...terrains.map(t => ({
      kind: 'terrain' as const,
      id: t.id,
      nom: t.nom,
      prix: calculerPrixClient(t.prix_horaire),
      image: SPORT_EMOJI[t.sport_type],
    })),
    ...beautyServices.map(s => ({
      kind: 'beaute' as const,
      id: s.id,
      nom: s.nom,
      prix: calculerPrixClient(s.prix),
      image: '💈',
    })),
  ];

  // Aperçu : sélection live (admin + payant), fusion sans doublon, mappée au format carrousel client
  const previewRang = quota && quota.type_classement !== 'bienvenue' ? quota.rang : null;
  const previewItems: PreviewItem[] = (() => {
    const map = new Map<string, PreviewItem>();
    const toPreview = (it: EligibleItem, rang: number | null): PreviewItem => ({
      id: it.id,
      nom: it.nom,
      prix: it.prix,
      image: it.image,
      prixPromo: it.prixPromo,
      promoBadge: it.promoBadge,
      rang,
    });
    selectedIds.forEach(id => {
      const it = eligibleItems.find(e => e.id === id);
      if (it) map.set(id, toPreview(it, previewRang));
    });
    // Union des produits sélectionnés sur TOUS les forfaits actifs.
    Object.values(paidSelBySub).flat().forEach(id => {
      if (map.has(id)) return;
      const it = paidEligibleItems.find(e => e.id === id);
      if (it) map.set(id, toPreview(it, null));
    });
    return Array.from(map.values());
  })();

  const toggleAdmin = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= quotaN) {
        Alert.alert(
          'Quota atteint',
          `Tu peux mettre en avant ${quotaN} produit${quotaN > 1 ? 's' : ''} maximum.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const togglePaid = (sub: ActiveSub, id: string) => {
    const effectiveQuota = paidQuotaFor(sub);
    setPaidSelBySub(prev => {
      const cur = prev[sub.id] ?? [];
      if (cur.includes(id)) return { ...prev, [sub.id]: cur.filter(p => p !== id) };
      if (effectiveQuota > 0 && cur.length >= effectiveQuota) {
        Alert.alert(
          'Quota atteint',
          `Tu peux sélectionner ${effectiveQuota} produit${effectiveQuota > 1 ? 's' : ''} maximum pour ce forfait.`,
        );
        return prev;
      }
      return { ...prev, [sub.id]: [...cur, id] };
    });
  };

  const handleSaveAdmin = async () => {
    if (!userId || !quota) return;
    setSaving(true);
    try {
      const items = selectedIds.map(id => {
        const item = eligibleItems.find(it => it.id === id) ?? eligibleItems[0];
        return {
          productId: item.kind === 'product' ? item.id : null,
          terrainId: item.kind === 'terrain' ? item.id : null,
          beautyServiceId: item.kind === 'beaute' ? item.id : null,
          nom: item.nom,
          prix: item.prix,
          imageUrl: item.image,
        };
      });
      await setCarrouselSelection(userId, quota.periode, quota.rang, items);
      Alert.alert('Enregistré', 'Ta sélection "Offre du Quartier" a été mise à jour.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (e) {
      notifyError(getErrorMessage(e, "Impossible d'enregistrer ta sélection"));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaid = async (sub: ActiveSub) => {
    const sel = paidSelBySub[sub.id] ?? [];
    if (sel.length === 0) return;
    setSavingSubId(sub.id);
    try {
      await updateSubProducts(sub.id, sel);
      Alert.alert('Enregistré', 'Ta sélection "Pack Visibilité" a été mise à jour.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (e) {
      notifyError(getErrorMessage(e, "Impossible d'enregistrer ta sélection"));
    } finally {
      setSavingSubId(null);
    }
  };

  const hasContent = !!quota || paidSubs.length > 0;

  const teaserItems: PreviewItem[] = eligibleItems.slice(0, 5).map(it => ({
    id: it.id,
    nom: it.nom,
    prix: it.prix,
    image: it.image,
    prixPromo: it.prixPromo,
    promoBadge: it.promoBadge,
    rang: null,
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.title}>Offre du Quartier</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !hasContent ? (
        <View style={styles.empty}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M2 20h20" stroke={colors.accent} />
            <Path d="m3 9 4 2 5-7 5 7 4-2-2 11H5L3 9z" stroke={colors.accent} />
          </Svg>
          <Text style={styles.emptyTitle}>Pas encore débloqué</Text>
          <Text style={styles.emptyTxt}>
            Termine dans le Top 5 du classement national pour débloquer un emplacement dans le
            carrousel "Offre du Quartier", mis en avant sur l'accueil de tous les clients.
          </Text>
          {eligibleItems.length > 0 && (
            <TouchableOpacity
              style={styles.teaserBtn}
              onPress={() => setTeaserOpen(true)}
              activeOpacity={0.85}
            >
              <IcoEye />
              <Text style={styles.teaserBtnTxt}>Voir l'aperçu du carrousel</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── SECTION ADMIN (Cadeau / Classement) ─────────────────────── */}
          {quota && (
            <>
              <View style={styles.adminBanner}>
                <Text style={styles.adminBannerTitle}>
                  {quota.type_classement === 'bienvenue'
                    ? 'Cadeau de bienvenue'
                    : `Top ${quota.rang} national`}
                </Text>
                <View style={styles.bannerRow}>
                  <Text style={styles.bannerMeta}>
                    {quotaN} produit{quotaN > 1 ? 's' : ''} à choisir
                  </Text>
                  {formatDaysRemaining(quota.valide_jusqu_a) && (
                    <View style={styles.expiryBadge}>
                      <Text style={styles.expiryBadgeTxt}>
                        {formatDaysRemaining(quota.valide_jusqu_a)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.counter}>
                  {selectedIds.length}/{quotaN} sélectionné{selectedIds.length > 1 ? 's' : ''}
                </Text>
              </View>

              <ProductList
                items={eligibleItems}
                selectedIds={selectedIds}
                onToggle={toggleAdmin}
                quotaN={quotaN}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveAdmin}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnTxt}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── SÉPARATEUR ───────────────────────────────────────────────── */}
          {quota && paidSubs.length > 0 && <View style={styles.divider} />}

          {/* ── SECTION PAYANTE : un forfait CUMULABLE par carte ──────────── */}
          {paidSubs.map((sub, idx) => {
            const sel = paidSelBySub[sub.id] ?? [];
            const quotaP = paidQuotaFor(sub);
            const savingThis = savingSubId === sub.id;
            return (
              <View key={sub.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.paidBanner}>
                  <View style={styles.paidBannerBadge}>
                    <Text style={styles.paidBannerBadgeTxt}>
                      FORFAIT ACTIF · {sub.planLabel.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.paidBannerTitle}>Pack Visibilité payant</Text>
                  <View style={styles.bannerRow}>
                    <Text style={styles.bannerMeta}>
                      {sub.allProducts
                        ? 'Toute ta vitrine mise en avant'
                        : `${sub.productCount} produit${sub.productCount > 1 ? 's' : ''} à choisir`}
                    </Text>
                  </View>
                  <Text style={styles.paidBannerExpiry}>
                    Expire le {formatDateLong(sub.expiresAt)}
                  </Text>
                  {!sub.allProducts && (
                    <Text style={styles.counter}>
                      {sel.length}/{sub.productCount} sélectionné{sel.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                {/* Liste toujours affichée — même allProducts=true (choix précis possible) */}
                {paidEligibleItems.length > 0 && (
                  <>
                    {sub.allProducts && (
                      <Text style={styles.paidPickerHint}>
                        Actuellement toute ta vitrine est mise en avant. Tu peux choisir des produits précis ci-dessous.
                      </Text>
                    )}
                    <ProductList
                      items={paidEligibleItems}
                      selectedIds={sel}
                      onToggle={(id) => togglePaid(sub, id)}
                      quotaN={quotaP || paidEligibleItems.length}
                    />

                    <TouchableOpacity
                      style={[styles.saveBtn, styles.saveBtnPaid, savingThis && styles.saveBtnDisabled]}
                      onPress={() => handleSavePaid(sub)}
                      disabled={savingThis || sel.length === 0}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveBtnTxt}>
                        {savingThis ? 'Enregistrement…' : 'Enregistrer la sélection'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}

          {/* ── Bouton aperçu (bas d'écran) ──────────────────────────────── */}
          {previewItems.length > 0 && (
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => setPreviewOpen(true)}
              activeOpacity={0.85}
            >
              <IcoEye />
              <Text style={styles.previewBtnTxt}>Aperçu de mon offre du quartier</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      )}

      <OffreQuartierPreviewModal
        visible={previewOpen}
        items={previewItems}
        onClose={() => setPreviewOpen(false)}
      />

      <OffreQuartierPreviewModal
        visible={teaserOpen}
        items={teaserItems}
        onClose={() => setTeaserOpen(false)}
        teaser
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.white, fontFamily: fonts.title, fontSize: 18 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIco: { marginBottom: 6 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  scroll: { paddingBottom: 32, flexGrow: 1 },

  // ── Admin banner ────────────────────────────────────────────────────────────
  adminBanner: {
    margin: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
  },
  adminBannerTitle: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },

  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bannerMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 },

  expiryBadge: {
    backgroundColor: 'rgba(253,207,52,.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  expiryBadgeTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 10.5 },

  counter: { color: colors.white, fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },

  // ── Divider ─────────────────────────────────────────────────────────────────
  divider: {
    marginHorizontal: 18,
    marginVertical: 20,
    height: 1,
    backgroundColor: colors.border,
  },

  // ── Paid banner ─────────────────────────────────────────────────────────────
  paidBanner: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: 'rgba(95, 211, 138, 0.07)',
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: radius.lg,
    padding: 16,
    gap: 5,
  },
  paidBannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(95, 211, 138, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  paidBannerBadgeTxt: { color: colors.success, fontFamily: fonts.ui, fontSize: 10, letterSpacing: 0.5 },
  paidBannerTitle: { color: colors.success, fontFamily: fonts.titleXL, fontSize: 16 },
  paidBannerExpiry: { color: colors.white, fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  paidPickerHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginHorizontal: 18,
    marginBottom: 10,
    lineHeight: 17,
  },

  // ── Product list ────────────────────────────────────────────────────────────
  list: { marginHorizontal: 18, gap: 8, marginBottom: 8 },

  emptyProducts: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 16,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
  },
  cardSel: { borderColor: colors.accent, backgroundColor: 'rgba(253,207,52,.05)' },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSel: { borderColor: colors.accent, backgroundColor: colors.accent },

  img: { width: 44, height: 44, borderRadius: 10, flexShrink: 0 },
  emojiBox: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emojiTxt: { fontSize: 22 },

  info: { flex: 1 },
  name: { color: colors.white, fontFamily: fonts.title, fontSize: 13.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  price: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 13 },
  priceOld: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, textDecorationLine: 'line-through' },
  promoBadge: {
    backgroundColor: 'rgba(253,207,52,.18)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  promoBadgeTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 9 },

  // ── Save buttons ────────────────────────────────────────────────────────────
  saveBtn: {
    marginHorizontal: 18,
    marginTop: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPaid: { backgroundColor: colors.success },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  // ── Bouton aperçu teaser (état vide) ─────────────────────────────────────────
  teaserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.06)',
  },
  teaserBtnTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },

  // ── Bouton aperçu ─────────────────────────────────────────────────────────────
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 16,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  previewBtnTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15 },
});
