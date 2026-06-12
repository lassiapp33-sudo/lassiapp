import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useT } from '../../i18n';

import HomeHeader from '../../components/home/HomeHeader';
import SearchBar from '../../components/home/SearchBar';
import TabSelector, { HomeTab } from '../../components/home/TabSelector';
import CategoryGrid from '../../components/home/CategoryGrid';
import { CatId } from '../../components/category/CatNavBar';
import PromoBanner from '../../components/home/PromoBanner';
import NearbyCard, { NearbyPlace } from '../../components/home/NearbyCard';
import BottomNav, { NavTab, NAV_HEIGHT } from '../../components/home/BottomNav';
import WelcomeClientModal from '../../components/home/WelcomeClientModal';
import { colors, fonts, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import useAuthStore from '../../store/authStore';
import useFavoritesStore from '../../store/favoritesStore';
import useNotificationsStore from '../../store/notificationsStore';
import useLocationStore from '../../store/locationStore';
import * as shopsService from '../../services/shops';
import { getBadgesActifsBatch, RecompenseAttribuee } from '../../services/classementService';
import { haversineMeters, formatDistance } from '../../services/location';
import { computeStatus, WeekHours } from '../../services/hours';

interface Props {
  onCategoryPress?: (catId: CatId, title: string) => void;
  onShopPress?: (shopId: string, shopName: string) => void;
  onSearch?: () => void;
  onVoice?: () => void;
  onFavorites?: () => void;
  onRecent?: () => void;
  onMessages?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onMap?: () => void;
  onTerrains?: () => void;
  onShopItemPress?: (shopId: string, shopName: string, productId: string) => void;
}

export default function ClientHomeScreen({
  onCategoryPress,
  onShopPress,
  onSearch,
  onVoice,
  onFavorites,
  onRecent,
  onMessages,
  onNotifications,
  onProfile,
  onMap,
  onTerrains,
  onShopItemPress,
}: Props) {
  const t = useT();

  const [tab, setTab] = useState<HomeTab>('nearby');
  const [navTab, setNavTab] = useState<NavTab>('home');
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const userId = useAuthStore(s => s.user?.id);
  const userInitial = useAuthStore(s => s.user?.initial ?? 'A');
  const userName = useAuthStore(s => s.user?.name ?? '');
  const userAvatarUrl = useAuthStore(s => s.user?.avatarUrl);
  const unreadCount = useNotificationsStore(s => s.notifications.filter(n => n.unread).length);
  const favorites = useFavoritesStore(s => s.favorites);
  const loadFavorites = useFavoritesStore(s => s.loadFavorites);
  const zoneName = useLocationStore(s => s.zoneName);
  const refreshLocation = useLocationStore(s => s.refreshLocation);

  async function loadShops() {
    setLoading(true);
    setLoadError(false);
    try {
      const shops = await shopsService.getShops();

      const merchantIds = shops.map(shop => shop.merchantId).filter((id): id is string => !!id);
      const badgeMap = await getBadgesActifsBatch(merchantIds).catch(
        () => ({}) as Record<string, RecompenseAttribuee>,
      );

      // Toutes les boutiques → liste "Tout près de toi"
      const currentCoords = useLocationStore.getState().coords;
      const places: NearbyPlace[] = shops.map(shop => {
        const distance =
          currentCoords && shop.latitude && shop.longitude
            ? formatDistance(
                haversineMeters(
                  currentCoords.latitude,
                  currentCoords.longitude,
                  shop.latitude,
                  shop.longitude,
                ),
              )
            : '';
        const shopStatus = computeStatus(
          shop.openingHours as WeekHours | null,
          shop.isManuallyClose,
        );
        return {
          id: shop.id,
          name: shop.name,
          category: shop.category,
          rating: shop.rating,
          distance,
          isVip: shop.isVip,
          isChampion: !!shop.merchantId && !!badgeMap[shop.merchantId],
          isFav: favorites.includes(shop.id),
          status: shopStatus.isOpen ? 'open' : 'closed',
          statusLabel: shopStatus.label,
          logoUrl: shop.logoUrl,
        } as NearbyPlace;
      });

      // Tri par distance si la position est disponible
      if (currentCoords) {
        places.sort((a, b) => {
          const toM = (s: string) => {
            if (!s) return 999999;
            if (s.includes('km')) return parseFloat(s) * 1000;
            return parseFloat(s);
          };
          return toM(a.distance) - toM(b.distance);
        });
      }

      setNearby(places);
      setLoadError(false);
    } catch {
      setNearby([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  // Montage seul — loadShops est une fonction locale (non memoized), l'ajouter créerait une boucle infinie
  useEffect(() => {
    loadFavorites();
    refreshLocation();
    loadShops();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Message de bienvenue (essentiel de LASSI) — affiché une seule fois,
  // mémorisé par compte via AsyncStorage.
  useEffect(() => {
    if (!userId) return;
    const seenKey = `welcome_client_seen_${userId}`;
    AsyncStorage.getItem(seenKey)
      .then(seen => {
        if (!seen) setShowWelcome(true);
      })
      .catch(() => {});
  }, [userId]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (userId) AsyncStorage.setItem(`welcome_client_seen_${userId}`, '1').catch(() => {});
  };

  const handleNavPress = (t: NavTab) => {
    setNavTab(t);
    if (t === 'favorites') onFavorites?.();
    if (t === 'voice') onVoice?.();
    if (t === 'messages') onMessages?.();
    if (t === 'profile') onProfile?.();
  };

  // Gestion du grid de catégories : 'map' déclenche l'écran carte
  const handleCategorySelect = (id: string, label: string) => {
    if (id === 'map') {
      onMap?.();
      return;
    }
    onCategoryPress?.(id as CatId, label);
  };

  return (
    <LassiScreen
      header={
        <View style={{ paddingTop: TOP_INSET }}>
          <View style={styles.px}>
            <HomeHeader
              quartier={zoneName}
              initial={userInitial}
              name={userName}
              avatarUrl={userAvatarUrl}
              unreadCount={unreadCount}
              onAvatar={onNotifications}
              onLocation={refreshLocation}
            />
          </View>
          <View style={styles.px}>
            <SearchBar value="" onChangeText={() => {}} onPress={onSearch} onMicPress={onVoice} />
          </View>
          <View style={styles.px}>
            <TabSelector
              active={tab}
              onChange={setTab}
              onNearbyPress={onMap}
              onRecentPress={onRecent}
            />
          </View>
        </View>
      }
      footer={<BottomNav active={navTab} onPress={handleNavPress} />}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: NAV_HEIGHT + 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHead}>
          <Text style={styles.secTitle}>{t.home.explore}</Text>
        </View>
        <View style={styles.px}>
          <CategoryGrid onSelect={handleCategorySelect} />
        </View>

        {/* Produits en vitrine — carrousel auto-défilant avec indicateurs */}
        <PromoBanner onPress={onShopItemPress} />

        {/* Boutiques à proximité */}
        <View style={styles.px}>
          <View style={styles.sectionHead}>
            <Text style={styles.secTitle}>{t.home.nearby}</Text>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : loadError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>
                Connexion impossible, vérifie ta connexion et réessaie.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadShops} activeOpacity={0.8}>
                <Text style={styles.retryTxt}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : nearby.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>{t.home.noShops}</Text>
            </View>
          ) : (
            nearby.map(place => (
              <NearbyCard
                key={place.id}
                place={{ ...place, isFav: favorites.includes(place.id) }}
                onPress={() => onShopPress?.(place.id, place.name)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <WelcomeClientModal visible={showWelcome} onClose={dismissWelcome} />
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  secTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  terrainBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: `${colors.accent}40`,
    borderRadius: 16, padding: 16, marginBottom: 28, marginTop: 8,
  },
  terrainBannerLeft: { flex: 1, gap: 4 },
  terrainBannerEmoji: { fontSize: 22, letterSpacing: 2, marginBottom: 2 },
  terrainBannerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  terrainBannerSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  terrainBannerArrow: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },
  loader: { paddingVertical: 32, alignItems: 'center' },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
