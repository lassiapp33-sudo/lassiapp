import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Product } from './ProductTile';
import { ProductPromoInfo } from '../../types/promotions';
import { formatPrice } from '../../utils/format';
import { calcPromoClientPrice } from '../../services/promotions';
import ImageZoomModal from '../common/ImageZoomModal';

const IcoClose = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" stroke={colors.white} />
  </Svg>
);

interface Props {
  product: Product | null;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
  promoInfo?: ProductPromoInfo;
  isVip?: boolean;
  isPreview?: boolean;
}

export default function ProductDetailModal({
  product,
  qty,
  onAdd,
  onRemove,
  onClose,
  promoInfo,
  isVip = false,
  isPreview = false,
}: Props) {
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const imgs = useMemo(() => {
    const list = product?.images && product.images.length > 0
      ? product.images
      : product?.photoUrl
        ? [product.photoUrl]
        : [];
    return list;
  }, [product]);

  if (!product) return null;

  const isOut = product.stock === 'out';
  const prixPromo = isPreview ? null : calcPromoClientPrice(product.price, promoInfo, isVip);
  const imgW = width;

  return (
    <Modal visible={!!product} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <IcoClose />
          </TouchableOpacity>

          {/* Carrousel images */}
          <View style={styles.gallery}>
            {imgs.length > 0 ? (
              <FlatList
                data={imgs}
                keyExtractor={(u, i) => `${i}-${u}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, i) => ({ length: imgW, offset: imgW * i, index: i })}
                onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / imgW))}
                renderItem={({ item, index }) => (
                  <Pressable onPress={() => setZoomIndex(index)} style={{ width: imgW }}>
                    <Image source={{ uri: item }} style={styles.galleryImg} contentFit="cover" transition={150} />
                  </Pressable>
                )}
              />
            ) : (
              <View style={[styles.galleryImg, styles.emojiZone]}>
                <Text style={styles.emoji}>{product.emoji || '🛍️'}</Text>
              </View>
            )}
            {imgs.length > 1 && (
              <View style={styles.dots}>
                {imgs.map((_, i) => (
                  <View key={i} style={[styles.dot, i === idx && styles.dotOn]} />
                ))}
              </View>
            )}
          </View>

          {/* Infos + description scrollable */}
          <View style={styles.body}>
            <Text style={styles.name}>{product.name}</Text>
            {prixPromo !== null ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceOld}>{formatPrice(product.price)}</Text>
                <Text style={styles.pricePromo}>{formatPrice(prixPromo)}</Text>
              </View>
            ) : (
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
            )}
            {!isOut && product.stockQuantity != null && (
              <Text style={[styles.stock, product.stockQuantity <= 5 && styles.stockLow]}>
                {product.stockQuantity} restant{product.stockQuantity > 1 ? 's' : ''}
              </Text>
            )}
            {isOut && <Text style={styles.epuise}>Épuisé</Text>}

            {product.desc ? (
              <ScrollView style={styles.descScroll} showsVerticalScrollIndicator>
                <Text style={styles.desc}>{product.desc}</Text>
              </ScrollView>
            ) : null}
          </View>

          {/* Barre action panier */}
          {!isOut && !isPreview && (
            <View style={styles.actionBar}>
              {qty === 0 ? (
                <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.85}>
                  <Text style={styles.addTxt}>Ajouter au panier</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyBar}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={onRemove} activeOpacity={0.8}>
                    <Text style={styles.qtyOp}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={onAdd} activeOpacity={0.8}>
                    <Text style={styles.qtyOp}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <ImageZoomModal
        uris={zoomIndex !== null ? imgs : null}
        startIndex={zoomIndex ?? 0}
        onClose={() => setZoomIndex(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,7,18,0.78)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,21,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallery: { width: '100%', aspectRatio: 1, backgroundColor: '#1a1b38' },
  galleryImg: { width: '100%', height: '100%' },
  emojiZone: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 72 },
  dots: { position: 'absolute', bottom: 12, flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: colors.accent, width: 18 },

  body: { paddingHorizontal: 18, paddingTop: 16 },
  name: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, lineHeight: 26 },
  price: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20, marginTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  priceOld: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textDecorationLine: 'line-through' },
  pricePromo: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },
  stock: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  stockLow: { color: '#F97316' },
  epuise: { color: colors.danger, fontFamily: fonts.titleXL, fontSize: 12, marginTop: 6 },
  descScroll: { marginTop: 12, maxHeight: 180 },
  desc: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },

  actionBar: { padding: 16, paddingBottom: 26 },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },
  qtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    height: 52,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  qtyBtn: { width: 56, height: 52, alignItems: 'center', justifyContent: 'center' },
  qtyOp: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 24 },
  qtyNum: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 18, minWidth: 40, textAlign: 'center' },
});
