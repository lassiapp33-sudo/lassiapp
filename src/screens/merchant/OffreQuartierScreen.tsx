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
import { formatPrice } from '../../utils/format';
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
import { getErrorMessage, notifyError } from '../../utils/errorUtils';

// Sports terrain éligibles à une mise en avant carrousel (emoji ⚽/🏀 à la place d'une photo)
const TERRAIN_SPORTS_ELIGIBLES = ['football', 'basketball'] as const;

interface EligibleItem {
  kind: 'product' | 'terrain';
  id: string;
  nom: string;
  prix: number;
  image: string; // URL http(s) ou emoji
}

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface Props {
  onBack: () => void;
}

export default function OffreQuartierScreen({ onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const shopId = useShopStore(s => s.shopId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quota, setQuota] = useState<RecompenseAttribuee | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId || !shopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [reward, mine, allProducts, myTerrains] = await Promise.all([
        getMonCarrouselQuota(userId),
        getMesProduitsCarrousel(userId),
        getProducts(shopId),
        getTerrainsByMerchant(userId),
      ]);
      setQuota(reward);
      setProducts(allProducts);
      setTerrains(
        myTerrains.filter(
          t => t.actif && (TERRAIN_SPORTS_ELIGIBLES as readonly string[]).includes(t.sport_type),
        ),
      );
      setSelectedIds(
        mine.map(item => item.product_id ?? item.terrain_id).filter((id): id is string => !!id),
      );
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger ton "Offre du Quartier"'));
    } finally {
      setLoading(false);
    }
  }, [userId, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const quotaN = quota?.carrousel_produits ?? 0;
  // Éligible : produit en stock avec photo OU emoji, ou terrain foot/basket actif
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

  const toggle = (id: string) => {
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

  const handleSave = async () => {
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
      Alert.alert('Enregistré', 'Ta sélection "Offre du Quartier" a été mise à jour.');
    } catch (e) {
      notifyError(getErrorMessage(e, "Impossible d'enregistrer ta sélection"));
    } finally {
      setSaving(false);
    }
  };

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
      ) : !quota ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👑</Text>
          <Text style={styles.emptyTitle}>Pas encore débloqué</Text>
          <Text style={styles.emptyTxt}>
            Termine dans le Top 5 du classement mondial pour débloquer un emplacement dans le
            carrousel "Offre du Quartier", mis en avant sur l'accueil de tous les clients.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {quota.type_classement === 'bienvenue' ? '🎁 Cadeau de bienvenue' : `Top ${quota.rang} mondial 🎉`}
            </Text>
            <Text style={styles.bannerTxt}>
              Choisis jusqu'à {quotaN} produit{quotaN > 1 ? 's' : ''} à mettre en avant dans le
              carrousel "Offre du Quartier".
            </Text>
            <Text style={styles.counter}>
              {selectedIds.length}/{quotaN} sélectionné{selectedIds.length > 1 ? 's' : ''}
            </Text>
          </View>

          {eligibleItems.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyTxt}>
                Ajoute un produit en stock (avec photo ou emoji) à ta vitrine, ou enregistre un
                terrain foot/basket, pour pouvoir le mettre en avant ici.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {eligibleItems.map(item => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, selected && styles.cardSel]}
                    onPress={() => toggle(item.id)}
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
                      <Text style={styles.name} numberOfLines={1}>
                        {item.nom}
                      </Text>
                      <Text style={styles.price}>{formatPrice(item.prix)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnTxt}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
          </TouchableOpacity>
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
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 18,
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  scroll: { paddingBottom: 32, flexGrow: 1 },

  banner: {
    margin: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
  },
  bannerTitle: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  bannerTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  counter: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginTop: 4,
  },

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
  cardSel: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.05)',
  },

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
  checkboxSel: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },

  img: {
    width: 44,
    height: 44,
    borderRadius: 10,
    flexShrink: 0,
  },
  emojiBox: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiTxt: { fontSize: 22 },

  info: { flex: 1 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 13,
    marginTop: 2,
  },

  saveBtn: {
    marginHorizontal: 18,
    marginTop: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
});
