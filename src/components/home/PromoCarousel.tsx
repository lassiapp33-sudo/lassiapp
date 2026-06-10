import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';
import { usePromoItems, PromoItem } from '../../hooks/usePromoItems';

const W = Dimensions.get('window').width;
// marginHorizontal:16 × 2 = 32 | padding:14 × 2 = 28 | gap:10 × 2 = 20 → 80
const CARD_WIDTH = Math.floor((W - 80) / 3);
const ITEM_STRIDE = CARD_WIDTH + 10; // gap entre cartes
const INTERVAL_MS = 2800;

// ─── Indicateurs de page ─────────────────────────────────────────────────────

function DotsIndicator({ total, active }: { total: number; active: number }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[dot.d, i === active && dot.active]} />
      ))}
    </View>
  );
}

const dot = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  d: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2a3470' },
  active: { width: 14, backgroundColor: '#FBBF24', borderRadius: 3 },
});

// ─── Carte produit ────────────────────────────────────────────────────────────

function PromoCard({
  item,
  onPress,
}: {
  item: PromoItem;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.promoCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={styles.cardShop} numberOfLines={1}>
        {item.shopName || item.shopCategory}
      </Text>
      <Text style={styles.cardItem} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.cardPrice}>{formatPrice(calculerPrixClient(item.price))}</Text>
    </TouchableOpacity>
  );
}

// ─── Carrousel ────────────────────────────────────────────────────────────────

interface Props {
  onPress?: (shopId: string) => void;
}

export default function PromoCarousel({ onPress }: Props) {
  const { items } = usePromoItems();
  const N = items.length;
  const totalPages = Math.ceil(N / 3);

  // Liste triplée : copy1 | copy2 (départ) | copy3 (buffer boucle)
  const looped = useMemo(
    () => (N >= 3 ? [...items, ...items, ...items] : []),
    [items, N],
  );

  const scrollRef = useRef<ScrollView>(null);
  const idxRef = useRef(N);
  const jumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (N < 3) return;

    idxRef.current = N;
    setPage(0);

    // Positionnement initial sur copy2 après layout
    const init = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: N * ITEM_STRIDE, animated: false });
    }, 100);

    const timer = setInterval(() => {
      idxRef.current += 1;
      const idx = idxRef.current;

      scrollRef.current?.scrollTo({ x: idx * ITEM_STRIDE, animated: true });
      setPage(Math.floor(((idx - N) % N) / 3));

      // Arrivé à copy3[0] (= copy2[0] visuellement) → retour silencieux
      if (idx === N * 2) {
        jumpRef.current = setTimeout(() => {
          idxRef.current = N;
          setPage(0);
          scrollRef.current?.scrollTo({ x: N * ITEM_STRIDE, animated: false });
        }, 400);
      }
    }, INTERVAL_MS);

    return () => {
      clearTimeout(init);
      clearInterval(timer);
      if (jumpRef.current) clearTimeout(jumpRef.current);
    };
  }, [N]);

  if (N < 3) return null;

  return (
    <View style={styles.promoWrapper}>
      {/* En-tête */}
      <View style={styles.promoHeader}>
        <Text style={styles.promoLabel}>🔥 Offres du quartier</Text>
        <DotsIndicator total={totalPages} active={page} />
      </View>

      {/* Carrousel 3 cartes */}
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {looped.map((item, i) => (
          <PromoCard
            key={`${item.id}-${i}`}
            item={item}
            onPress={() => onPress?.(item.shopId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  promoWrapper: {
    backgroundColor: '#12193a',
    borderRadius: radius.lg,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promoLabel: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  promoCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1a2452',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2a3470',
    minHeight: 90,
    justifyContent: 'space-between',
  },
  cardShop: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardItem: {
    color: '#E2E8F8',
    fontSize: 12,
    fontWeight: '500',
    marginVertical: 4,
    flex: 1,
  },
  cardPrice: {
    backgroundColor: '#FBBF24',
    color: '#12193a',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
