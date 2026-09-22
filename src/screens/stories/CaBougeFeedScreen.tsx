/**
 * CaBougeFeedScreen — Écran « Ça bouge ».
 * Stories quotidiennes des prestataires du quartier, affichées en rond.
 * Tap sur un rond → StoryViewer plein écran.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import Avatar from '../../components/Avatar';
import { IcoBack } from '../../components/icons';
import StoryViewer from '../../components/stories/StoryViewer';
import { getStoriesFeed, ShopStories } from '../../services/stories';

interface Props {
  onBack: () => void;
  onOpenShop: (shopId: string, shopName: string) => void;
  onContactShop: (shopId: string, shopName: string, shopLogoUrl: string | null) => void;
}

export default function CaBougeFeedScreen({ onBack, onOpenShop, onContactShop }: Props) {
  const [feed, setFeed] = useState<ShopStories[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getStoriesFeed();
      setFeed(data);
    } catch {
      setFeed([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Marque localement la boutique comme vue après passage dans le viewer
  const markSeen = (shopIndex: number) => {
    setFeed(f =>
      f.map((s, i) => (i === shopIndex ? { ...s, hasUnseen: false } : s)),
    );
  };

  return (
    <LassiScreen
      header={
        <View style={[styles.head, { paddingTop: TOP_INSET }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <IcoBack />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ça bouge</Text>
            <Text style={styles.subtitle}>Les nouveautés du jour, près de toi</Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyBig}>Rien ne bouge encore 🌙</Text>
          <Text style={styles.emptyTxt}>
            Reviens plus tard : les commerçants publient leurs nouveautés du jour ici.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          {feed.map((shop, index) => (
            <TouchableOpacity
              key={shop.shopId}
              style={styles.ringItem}
              activeOpacity={0.8}
              onPress={() => setViewerIndex(index)}
            >
              <View style={[styles.ring, shop.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
                <Avatar
                  imageUrl={shop.shopLogoUrl}
                  name={shop.shopName}
                  size={62}
                  variant="shop"
                />
                {shop.streak > 1 && (
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakTxt}>🔥{shop.streak}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.ringName} numberOfLines={1}>
                {shop.shopName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {viewerIndex !== null && (
        <StoryViewer
          shops={feed}
          initialShopIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onShopSeen={markSeen}
          onOpenShop={onOpenShop}
          onContactShop={onContactShop}
        />
      )}
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyBig: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 40,
  },
  ringItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  ringUnseen: { borderColor: colors.accent },
  ringSeen: { borderColor: colors.border },
  streakBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 9.5 },
  ringName: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 10.5,
    marginTop: 8,
    maxWidth: 76,
    textAlign: 'center',
  },
});
