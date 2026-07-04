import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { getCarrouselOffreQuartier, CarrouselItem } from '../../services/classementService';
import { getPromosByProductIds, buildProductPromoMap, calcPromoClientPrice } from '../../services/promotions';
import { getProductRawPricesByIds } from '../../services/products';
import { ProductPromoInfo } from '../../types/promotions';

interface EnrichedCarrouselItem extends CarrouselItem {
  prixPromo?: number;
  promoBadge?: string;
}

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;
const CARD_GAP = 12;
const ITEM_STRIDE = CARD_W + CARD_GAP;
const INTERVAL_MS = 3000;

interface Props {
  onPress?: (item: CarrouselItem) => void;
}

export default function OffreDuQuartier({ onPress }: Props) {
  const [produits, setProduits] = useState<EnrichedCarrouselItem[]>([]);
  const listRef = useRef<FlatList<EnrichedCarrouselItem>>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await getCarrouselOffreQuartier();
        if (cancelled) return;

        const productIds = items.map(p => p.product_id).filter((id): id is string => !!id);
        if (productIds.length === 0) { setProduits(items); return; }

        const [rawPrices, promos] = await Promise.all([
          getProductRawPricesByIds(productIds),
          getPromosByProductIds(productIds),
        ]);
        if (cancelled) return;

        const promoMap = buildProductPromoMap(promos);
        const enriched: EnrichedCarrouselItem[] = items.map(item => {
          if (!item.product_id) return item;
          const rawPrice = rawPrices[item.product_id];
          const promoInfo: ProductPromoInfo | undefined = rawPrice != null ? promoMap[item.product_id] : undefined;
          const prixPromo = promoInfo != null && rawPrice != null
            ? calcPromoClientPrice(rawPrice, promoInfo) ?? undefined
            : undefined;
          return { ...item, prixPromo, promoBadge: promoInfo?.badge };
        });
        setProduits(enriched);
      } catch {
        if (!cancelled) setProduits([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Défilement automatique
  useEffect(() => {
    if (produits.length < 2) return;
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % produits.length;
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [produits]);

  if (produits.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✨ Offre du Quartier</Text>
      <FlatList
        ref={listRef}
        data={produits}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        snapToInterval={ITEM_STRIDE}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: ITEM_STRIDE, offset: ITEM_STRIDE * index, index })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => onPress?.(item)}
          >
            {item.image_url.startsWith('http') ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.img}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.img, styles.emojiBox]}>
                <Text style={styles.emojiTxt}>{item.image_url}</Text>
              </View>
            )}
            <View style={styles.overlay}>
              <Text style={styles.nom} numberOfLines={1}>
                {item.nom}
              </Text>
              <View style={styles.priceRow}>
                {item.prixPromo != null ? (
                  <>
                    <Text style={styles.prixOld}>{formatPrice(item.prix)}</Text>
                    <Text style={styles.prix}>{formatPrice(item.prixPromo)}</Text>
                  </>
                ) : (
                  <Text style={styles.prix}>{formatPrice(item.prix)}</Text>
                )}
                {item.promoBadge != null && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeTxt}>{item.promoBadge}</Text>
                  </View>
                )}
              </View>
            </View>
            {!!item.rang_prestataire && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>👑 Top {item.rang_prestataire}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  title: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 17,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, gap: CARD_GAP },
  card: {
    width: CARD_W,
    height: 180,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  img: { width: '100%', height: '100%' },
  emojiBox: { alignItems: 'center', justifyContent: 'center' },
  emojiTxt: { fontSize: 64 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(20,21,42,0.85)',
  },
  nom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  prixOld: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.body, fontSize: 11, textDecorationLine: 'line-through' },
  promoBadge: {
    backgroundColor: 'rgba(253,207,52,.25)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  promoBadgeTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 9 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.bg, fontFamily: fonts.title, fontSize: 11 },
});
