import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

export interface PreviewItem {
  id: string;
  nom: string;
  prix: number;
  image: string;
  prixPromo?: number;
  promoBadge?: string;
  rang?: number | null;
}

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;
const CARD_GAP = 12;
const ITEM_STRIDE = CARD_W + CARD_GAP;
const INTERVAL_MS = 3000;

const IcoClose = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.muted} />
  </Svg>
);

interface Props {
  visible: boolean;
  items: PreviewItem[];
  onClose: () => void;
  teaser?: boolean;
}

export default function OffreQuartierPreviewModal({ visible, items, onClose, teaser }: Props) {
  const listRef = useRef<FlatList<PreviewItem>>(null);
  const indexRef = useRef(0);

  // Défilement automatique (identique au carrousel client)
  useEffect(() => {
    if (!visible || items.length < 2) return;
    indexRef.current = 0;
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % items.length;
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [visible, items.length]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.grab} />

              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>
                  {teaser ? 'Comment tu apparaîtrais' : 'Aperçu de ton offre'}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <IcoClose />
                </TouchableOpacity>
              </View>
              <Text style={styles.sub}>
                {teaser
                  ? "Voici comment tes produits seraient mis en avant dans le carrousel de tes clients. Abonne-toi pour activer cette visibilité."
                  : "Voici exactement comment tes produits apparaissent aux clients sur l'accueil."}
              </Text>

              <View style={[styles.demoBadge, teaser && styles.demoBadgeTeaser]}>
                <Text style={[styles.demoBadgeTxt, teaser && styles.demoBadgeTxtTeaser]}>
                  {teaser ? '● NON ACTIF · APERÇU SEULEMENT' : '● APERÇU DÉMONSTRATIF'}
                </Text>
              </View>

              {items.length === 0 ? (
                <Text style={styles.empty}>
                  Sélectionne au moins un produit pour voir l'aperçu.
                </Text>
              ) : (
                <>
                  {/* Réplique fidèle du composant client OffreDuQuartier */}
                  <Text style={styles.oqTitle}>Offre du Quartier</Text>
                  <FlatList
                    ref={listRef}
                    data={items}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item.id}
                    snapToInterval={ITEM_STRIDE}
                    decelerationRate="fast"
                    getItemLayout={(_, index) => ({ length: ITEM_STRIDE, offset: ITEM_STRIDE * index, index })}
                    onScrollToIndexFailed={() => {}}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                      <View style={styles.card}>
                        {item.image.startsWith('http') ? (
                          <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" transition={150} />
                        ) : (
                          <View style={[styles.img, styles.emojiBox]}>
                            <Text style={styles.emojiTxt}>{item.image}</Text>
                          </View>
                        )}
                        <View style={styles.overlay}>
                          <Text style={styles.nom} numberOfLines={1}>{item.nom}</Text>
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
                        {!!item.rang && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Top {item.rang}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  />
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,6,15,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 26,
  },
  grab: { width: 42, height: 5, borderRadius: radius.pill, backgroundColor: '#3a3d68', alignSelf: 'center', marginTop: 8, marginBottom: 4 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 16 },
  sub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, paddingHorizontal: 20, paddingTop: 4 },

  demoBadge: {
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(95,211,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(95,211,138,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  demoBadgeTxt: { color: colors.success, fontFamily: fonts.ui, fontSize: 10.5, letterSpacing: 0.3 },
  demoBadgeTeaser: {
    backgroundColor: 'rgba(253,207,52,0.10)',
    borderColor: 'rgba(253,207,52,0.35)',
  },
  demoBadgeTxtTeaser: { color: colors.accent },

  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 30, lineHeight: 19 },

  // ── Réplique du carrousel client ────────────────────────────────────────────
  oqTitle: { color: colors.accent, fontFamily: fonts.title, fontSize: 17, marginBottom: 12, paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, gap: CARD_GAP, paddingBottom: 6 },
  card: { width: CARD_W, height: 180, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
  img: { width: '100%', height: '100%' },
  emojiBox: { alignItems: 'center', justifyContent: 'center' },
  emojiTxt: { fontSize: 64 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(20,21,42,0.85)' },
  nom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  prixOld: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.body, fontSize: 11, textDecorationLine: 'line-through' },
  promoBadge: { backgroundColor: 'rgba(253,207,52,.25)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  promoBadgeTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 9 },
  badge: { position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.bg, fontFamily: fonts.title, fontSize: 11 },
});
