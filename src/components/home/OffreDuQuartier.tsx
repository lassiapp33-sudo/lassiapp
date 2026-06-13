import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { getCarrouselOffreQuartier, CarrouselItem } from '../../services/classementService';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;
const CARD_GAP = 12;
const ITEM_STRIDE = CARD_W + CARD_GAP;
const INTERVAL_MS = 3000;

interface Props {
  onPress?: (item: CarrouselItem) => void;
}

export default function OffreDuQuartier({ onPress }: Props) {
  const [produits, setProduits] = useState<CarrouselItem[]>([]);
  const listRef = useRef<FlatList<CarrouselItem>>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    getCarrouselOffreQuartier()
      .then(setProduits)
      .catch(() => setProduits([]));
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
              <Text style={styles.prix}>{formatPrice(item.prix)}</Text>
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
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 14, marginTop: 2 },
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
