import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';
import { calcPromoClientPrice } from '../../services/promotions';
import { usePromoItems, PromoItem } from '../../hooks/usePromoItems';

// ─── Constantes de mise en page ───────────────────────────────────────────────

const W = Dimensions.get('window').width;
// wrapper: marginH 16×2=32, padding 14×2=28, gap 12 entre 2 cartes → 32+28+12=72
const CARD_WIDTH = Math.floor((W - 72) / 2);
const CARD_GAP = 12;
const ITEM_STRIDE = CARD_WIDTH + CARD_GAP;
const IMG_H = Math.floor(CARD_WIDTH * 0.58); // proportion image réduite
const INTERVAL_MS = 3000;

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
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  d: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2a3470' },
  active: { width: 18, backgroundColor: '#FBBF24', borderRadius: 3 },
});

// ─── Carte produit ────────────────────────────────────────────────────────────

function PromoCard({
  item,
  onPress,
}: {
  item: PromoItem;
  onPress?: () => void;
}) {
  const prixTotal = calculerPrixClient(item.price);
  const prixPromo = calcPromoClientPrice(item.price, item.promoInfo);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Image / emoji du produit */}
      <View style={styles.imgBox}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.img} />
        ) : (
          <Text style={styles.emoji}>{item.emoji || '🛍️'}</Text>
        )}
      </View>

      {/* Texte : boutique · nom · prix */}
      <View style={styles.cardText}>
        <Text style={styles.cardShop} numberOfLines={1}>
          {item.shopName || item.shopCategory}
        </Text>
        <Text style={styles.cardItem} numberOfLines={2}>
          {item.name}
        </Text>
        {prixPromo !== null ? (
          <View style={styles.priceRow}>
            <Text style={styles.cardPriceOld}>{formatPrice(prixTotal)}</Text>
            <Text style={styles.cardPrice}>{formatPrice(prixPromo)}</Text>
          </View>
        ) : (
          <Text style={styles.cardPrice}>{formatPrice(prixTotal)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  onPress?: (shopId: string, shopName: string, productId: string) => void;
}

export default function PromoBanner({ onPress }: Props) {
  const { items } = usePromoItems();
  const N = items.length;
  const totalPages = Math.ceil(N / 2);

  // Liste triplée : copy1 | copy2 (départ) | copy3 (buffer boucle)
  const looped = useMemo(
    () => (N >= 2 ? [...items, ...items, ...items] : []),
    [items, N],
  );

  const scrollRef = useRef<ScrollView>(null);
  const idxRef = useRef(N);
  const jumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nRef = useRef(N);
  const [page, setPage] = useState(0);

  // Garder nRef à jour sans recréer les callbacks
  useEffect(() => { nRef.current = N; }, [N]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (resumeRef.current) { clearTimeout(resumeRef.current); resumeRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      const n = nRef.current;
      idxRef.current += 1;
      const idx = idxRef.current;
      scrollRef.current?.scrollTo({ x: idx * ITEM_STRIDE, animated: true });
      setPage(Math.floor(((idx - n) % n) / 2));
      if (idx === n * 2) {
        jumpRef.current = setTimeout(() => {
          idxRef.current = n;
          setPage(0);
          scrollRef.current?.scrollTo({ x: n * ITEM_STRIDE, animated: false });
        }, 400);
      }
    }, INTERVAL_MS);
  }, [stopTimer]);

  // Appelé quand le scroll manuel s'arrête : normalise la position et relance le timer
  const handleScrollEnd = useCallback((rawIdx: number) => {
    const n = nRef.current;
    let idx = rawIdx;
    if (rawIdx < n) {
      idx = n + ((rawIdx % n) + n) % n;
      scrollRef.current?.scrollTo({ x: idx * ITEM_STRIDE, animated: false });
    } else if (rawIdx >= n * 2) {
      idx = n + ((rawIdx - n) % n);
      scrollRef.current?.scrollTo({ x: idx * ITEM_STRIDE, animated: false });
    }
    idxRef.current = idx;
    setPage(Math.floor(((idx - n) % n) / 2));
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(startTimer, 800);
  }, [startTimer]);

  useEffect(() => {
    if (N < 2) return;
    idxRef.current = N;
    setPage(0);
    const init = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: N * ITEM_STRIDE, animated: false });
      startTimer();
    }, 100);
    return () => {
      clearTimeout(init);
      stopTimer();
      if (jumpRef.current) clearTimeout(jumpRef.current);
    };
  }, [N, startTimer, stopTimer]);

  if (N === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* Label section */}
      <Text style={styles.label}>🔥 Offres du quartier</Text>

      {N < 2 ? (
        // Un seul produit : carte centrée sans boucle
        <View style={styles.staticRow}>
          {items.map(item => (
            <PromoCard
              key={item.id}
              item={item}
              onPress={() => onPress?.(item.shopId, item.shopName, item.id)}
            />
          ))}
        </View>
      ) : (
        <>
          {/* Carrousel — scroll manuel activé, auto-défilement reprend après 2,5 s */}
          <ScrollView
            ref={scrollRef}
            horizontal
            scrollEnabled
            snapToInterval={ITEM_STRIDE}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={stopTimer}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_STRIDE);
              handleScrollEnd(idx);
            }}
            onScrollEndDrag={() => {
              // Fallback si pas de momentum (simple effleurement)
              handleScrollEnd(idxRef.current);
            }}
          >
            {looped.map((item, i) => (
              <PromoCard
                key={`${item.id}-${i}`}
                item={item}
                onPress={() => onPress?.(item.shopId, item.shopName, item.id)}
              />
            ))}
          </ScrollView>

          {/* Points indicateurs centrés en bas */}
          <DotsIndicator total={totalPages} active={page} />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#12193a',
    borderRadius: radius.lg,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 28,
    marginTop: 8,
  },
  label: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Rangée statique (1 seul produit actif)
  staticRow: {
    flexDirection: 'row',
  },

  // Carte — layout vertical : image en haut, texte en bas
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1a2452',
    borderRadius: 14,
    marginRight: CARD_GAP,
    borderWidth: 1,
    borderColor: '#2a3470',
    overflow: 'hidden',
  },

  // Zone image (haut de la carte)
  imgBox: {
    width: CARD_WIDTH,
    height: IMG_H,
    backgroundColor: '#0d1228',
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: CARD_WIDTH,
    height: IMG_H,
    resizeMode: 'cover',
  },
  emoji: { fontSize: Math.floor(IMG_H * 0.52) },

  // Zone texte (bas de la carte)
  cardText: {
    padding: 10,
    gap: 4,
  },
  cardShop: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  cardItem: {
    color: '#E2E8F8',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  cardPriceOld: {
    color: '#8892b0',
    fontSize: 9,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  cardPrice: {
    backgroundColor: '#FBBF24',
    color: '#12193a',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
