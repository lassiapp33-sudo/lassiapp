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
import { StoreProduct } from '../../types/store';
import { Terrain, SPORT_EMOJI } from '../../types/terrain';
import {
  getMonCarrouselQuota,
  getMesProduitsCarrousel,
  setCarrouselSelection,
  RecompenseAttribuee,
} from '../../services/classementService';
import { getActiveSub, updateSubProducts, ActiveSub } from '../../services/visibilityPayment';
import { getErrorMessage, notifyError } from '../../utils/errorUtils';

const TERRAIN_SPORTS_ELIGIBLES = ['football', 'basketball'] as const;

interface EligibleItem {
  kind: 'product' | 'terrain';
  id: string;
  nom: string;
  prix: number;
  image: string;
}

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
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
              <Text style={styles.price}>{formatPrice(item.prix)}</Text>
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
  const [savingPaid, setSavingPaid] = useState(false);
  const [quota, setQuota] = useState<RecompenseAttribuee | null>(null);
  const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paidSelectedIds, setPaidSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId || !shopId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [reward, mine, allProducts, myTerrains, sub] = await Promise.all([
        getMonCarrouselQuota(userId),
        getMesProduitsCarrousel(userId),
        getProducts(shopId),
        getTerrainsByMerchant(userId),
        getActiveSub(shopId, 'quartier'),
      ]);
      setQuota(reward);
      setActiveSub(sub);
      setProducts(allProducts);
      setTerrains(
        myTerrains.filter(
          t => t.actif && (TERRAIN_SPORTS_ELIGIBLES as readonly string[]).includes(t.sport_type),
        ),
      );
      setSelectedIds(
        mine.map(item => item.product_id ?? item.terrain_id).filter((id): id is string => !!id),
      );
      if (sub && !sub.allProducts) {
        setPaidSelectedIds(sub.productIds ?? (sub.productId ? [sub.productId] : []));
      }
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger ton "Offre du Quartier"'));
    } finally {
      setLoading(false);
    }
  }, [userId, shopId]);

  useEffect(() => { load(); }, [load]);

  const quotaN = quota?.carrousel_produits ?? 0;
  const paidQuotaN = activeSub && !activeSub.allProducts ? activeSub.productCount : 0;

  // Produits + terrains éligibles (section admin)
  const eligibleItems: EligibleItem[] = [
    ...products
      .filter(p => (p.photoUrl || p.emoji) && p.stock === 'in')
      .map(p => ({
        kind: 'product' as const,
        id: p.id,
        nom: p.name,
        prix: calculerPrixClient(p.price),
        image: p.photoUrl || p.emoji,
      })),
    ...terrains.map(t => ({
      kind: 'terrain' as const,
      id: t.id,
      nom: t.nom,
      prix: calculerPrixClient(t.prix_horaire),
      image: SPORT_EMOJI[t.sport_type],
    })),
  ];

  // Produits uniquement (section payante — le pack ne gère pas les terrains)
  const paidEligibleItems: EligibleItem[] = products
    .filter(p => (p.photoUrl || p.emoji) && p.stock === 'in')
    .map(p => ({
      kind: 'product' as const,
      id: p.id,
      nom: p.name,
      prix: calculerPrixClient(p.price),
      image: p.photoUrl || p.emoji,
    }));

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

  const togglePaid = (id: string) => {
    setPaidSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= paidQuotaN) {
        Alert.alert(
          'Quota atteint',
          `Ton pack permet de mettre en avant ${paidQuotaN} produit${paidQuotaN > 1 ? 's' : ''} maximum.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSaveAdmin = async () => {
    if (!userId || !quota) return;
    setSaving(true);
    try {
      const items = selectedIds.map(id => {
        const item = eligibleItems.find(it => it.id === id)!;
        return {
          productId: item.kind === 'product' ? item.id : null,
          terrainId: item.kind === 'terrain' ? item.id : null,
          nom: item.nom,
          prix: item.prix,
          imageUrl: item.image,
        };
      });
      await setCarrouselSelection(userId, quota.periode, quota.rang, items);
      Alert.alert('Enregistré', 'Ta sélection "Cadeau / Classement" a été mise à jour.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (e) {
      notifyError(getErrorMessage(e, "Impossible d'enregistrer ta sélection"));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaid = async () => {
    if (!activeSub || paidSelectedIds.length === 0) return;
    setSavingPaid(true);
    try {
      await updateSubProducts(paidSelectedIds);
      Alert.alert('Enregistré', 'Ta sélection "Pack Visibilité" a été mise à jour.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (e) {
      notifyError(getErrorMessage(e, "Impossible d'enregistrer ta sélection"));
    } finally {
      setSavingPaid(false);
    }
  };

  const hasContent = !!quota || !!activeSub;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.title}>👑 Offre du Quartier</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !hasContent ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👑</Text>
          <Text style={styles.emptyTitle}>Pas encore débloqué</Text>
          <Text style={styles.emptyTxt}>
            Termine dans le Top 5 du classement national pour débloquer un emplacement dans le
            carrousel "Offre du Quartier", mis en avant sur l'accueil de tous les clients.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── SECTION ADMIN (Cadeau / Classement) ─────────────────────── */}
          {quota && (
            <>
              <View style={styles.adminBanner}>
                <Text style={styles.adminBannerTitle}>
                  {quota.type_classement === 'bienvenue'
                    ? '🎁 Cadeau de bienvenue'
                    : `Top ${quota.rang} national 🎉`}
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
          {quota && activeSub && <View style={styles.divider} />}

          {/* ── SECTION PAYANTE (Pack Wave / OM / Crédit) ────────────────── */}
          {activeSub && (
            <>
              <View style={styles.paidBanner}>
                <View style={styles.paidBannerBadge}>
                  <Text style={styles.paidBannerBadgeTxt}>
                    FORFAIT ACTIF · {activeSub.planLabel.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.paidBannerTitle}>⭐ Pack Visibilité payant</Text>
                <View style={styles.bannerRow}>
                  <Text style={styles.bannerMeta}>
                    {activeSub.allProducts
                      ? 'Toute ta vitrine mise en avant'
                      : `${paidQuotaN} produit${paidQuotaN > 1 ? 's' : ''} à choisir`}
                  </Text>
                </View>
                <Text style={styles.paidBannerExpiry}>
                  Expire le {formatDateLong(activeSub.expiresAt)}
                </Text>
                {!activeSub.allProducts && (
                  <Text style={styles.counter}>
                    {paidSelectedIds.length}/{paidQuotaN} sélectionné{paidSelectedIds.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              {!activeSub.allProducts && (
                <>
                  <ProductList
                    items={paidEligibleItems}
                    selectedIds={paidSelectedIds}
                    onToggle={togglePaid}
                    quotaN={paidQuotaN}
                  />

                  <TouchableOpacity
                    style={[styles.saveBtn, styles.saveBtnPaid, savingPaid && styles.saveBtnDisabled]}
                    onPress={handleSavePaid}
                    disabled={savingPaid || paidSelectedIds.length === 0}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.saveBtnTxt}>
                      {savingPaid ? 'Enregistrement…' : 'Enregistrer'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

        </ScrollView>
      )}
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
  emptyEmoji: { fontSize: 40 },
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
  price: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 13, marginTop: 2 },

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
});
