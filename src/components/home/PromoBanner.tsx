import React, { useRef, useEffect, useMemo, useState } from 'react';
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
import { usePromoItems, PromoItem } from '../../hooks/usePromoItems';

// ─── Constantes de mise en page ───────────────────────────────────────────────

const W = Dimensions.get('window').width;
// marginH:16×2=32 | padding:14×2=28 | gap:10×2=20 → total hors cartes = 80
const CARD_WIDTH = Math.floor((W - 80) / 3);
const CARD_GAP = 10;
const ITEM_STRIDE = CARD_WIDTH + CARD_GAP;
const IMG_SIZE = Math.floor(CARD_WIDTH * 0.38); // ~38% de la largeur de carte
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
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  d: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2a3470' },
  active: { width: 16, backgroundColor: '#FBBF24', borderRadius: 3 },
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
        <Text style={styles.cardPrice}>{formatPrice(calculerPrixClient(item.price))}</Text>
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

    const init = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: N * ITEM_STRIDE, animated: false });
    }, 100);

    const timer = setInterval(() => {
      idxRef.current += 1;
      const idx = idxRef.current;

      scrollRef.current?.scrollTo({ x: idx * ITEM_STRIDE, animated: true });
      setPage(Math.floor(((idx - N) % N) / 3));

      // Arrivé sur copy3[0] (= copy2[0] visuellement) → retour silencieux
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

  if (N === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* Label section */}
      <Text style={styles.label}>🔥 Offres du quartier</Text>

      {N < 3 ? (
        // Peu d'annonceurs actifs : rangée statique, sans boucle ni dots
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
          {/* Carrousel */}
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

  // Rangée statique (1 ou 2 annonceurs actifs)
  // Pas de `gap` ici : chaque carte a déjà `marginRight: CARD_GAP`.
  staticRow: {
    flexDirection: 'row',
  },

  // Carte — layout row : image gauche + texte droite
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1a2452',
    borderRadius: 12,
    padding: 10,
    marginRight: CARD_GAP,
    borderWidth: 1,
    borderColor: '#2a3470',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minHeight: 82,
  },

  // Carré image / emoji
  imgBox: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: 8,
    backgroundColor: '#0d1228',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  img: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  emoji: { fontSize: Math.floor(IMG_SIZE * 0.62) },

  // Zone texte
  cardText: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 3,
  },
  cardShop: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '700',
  },
  cardItem: {
    color: '#E2E8F8',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
    flexShrink: 1,
  },
  cardPrice: {
    backgroundColor: '#FBBF24',
    color: '#12193a',
    fontSize: 9,
    fontWeight: '800',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
