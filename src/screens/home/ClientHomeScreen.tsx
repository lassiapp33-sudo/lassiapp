import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useT } from '../../i18n';

import HomeHeader                     from '../../components/home/HomeHeader';
import SearchBar                      from '../../components/home/SearchBar';
import TabSelector, { HomeTab }       from '../../components/home/TabSelector';
import CategoryGrid                   from '../../components/home/CategoryGrid';
import { CatId }                      from '../../components/category/CatNavBar';
import RecoCarousel, { RecoItem }     from '../../components/home/RecoCarousel';
import NearbyCard, { NearbyPlace }    from '../../components/home/NearbyCard';
import BottomNav, { NavTab, NAV_HEIGHT } from '../../components/home/BottomNav';
import { colors, fonts, TOP_INSET }   from '../../theme';
import LassiScreen                    from '../../components/LassiScreen';
import useAuthStore                   from '../../store/authStore';
import useFavoritesStore              from '../../store/favoritesStore';
import useNotificationsStore          from '../../store/notificationsStore';
import useLocationStore               from '../../store/locationStore';
import * as shopsService              from '../../services/shops';
import { haversineMeters, formatDistance } from '../../services/location';
import { computeStatus, WeekHours }  from '../../services/hours';

interface Props {
  onCategoryPress?:  (catId: CatId, title: string) => void;
  onShopPress?:      (shopId: string, shopName: string) => void;
  onSearch?:         () => void;
  onVoice?:          () => void;
  onFavorites?:      () => void;
  onRecent?:         () => void;
  onMessages?:       () => void;
  onNotifications?:  () => void;
  onProfile?:        () => void;
  onMap?:            () => void;
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
}: Props) {
  const t = useT();

  const [tab,     setTab]     = useState<HomeTab>('nearby');
  const [navTab,  setNavTab]  = useState<NavTab>('home');
  const [nearby,  setNearby]  = useState<NearbyPlace[]>([]);
  const [recos,   setRecos]   = useState<RecoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const userInitial       = useAuthStore(s => s.user?.initial  ?? 'A');
  const userName          = useAuthStore(s => s.user?.name     ?? '');
  const userAvatarUrl     = useAuthStore(s => s.user?.avatarUrl);
  const unreadCount       = useNotificationsStore(s => s.notifications.filter(n => n.unread).length);
  const favorites         = useFavoritesStore(s => s.favorites);
  const loadFavorites     = useFavoritesStore(s => s.loadFavorites);
  const coords            = useLocationStore(s => s.coords);
  const zoneName          = useLocationStore(s => s.zoneName);
  const refreshLocation   = useLocationStore(s => s.refreshLocation);

  async function loadShops() {
    try {
      const shops = await shopsService.getShops();

      // Recommandations : VIP scoring + vip_manual + featured_manual (tous calculés dans rowToShop)
      const recoShops: RecoItem[] = shops
        .filter(s => s.isVip || s.isFeatured)
        .map(s => ({
          id:      s.id,
          initial: s.name.charAt(0).toUpperCase(),
          name:    s.name,
          desc:    s.subtitle || `${s.category} · ${s.zone}`,
          logoUrl: s.logoUrl,
        }));
      setRecos(recoShops);

      // Toutes les boutiques → liste "Tout près de toi"
      const currentCoords = useLocationStore.getState().coords;
      const places: NearbyPlace[] = shops.map(shop => {
        const distance = (currentCoords && shop.latitude && shop.longitude)
          ? formatDistance(haversineMeters(
              currentCoords.latitude, currentCoords.longitude,
              shop.latitude, shop.longitude,
            ))
          : '';
        const shopStatus = computeStatus(
          shop.openingHours as WeekHours | null,
          shop.isManuallyClose,
        );
        return {
          id:          shop.id,
          name:        shop.name,
          category:    shop.category,
          rating:      shop.rating,
          distance,
          isVip:       shop.isVip,
          isFav:       favorites.includes(shop.id),
          status:      shopStatus.isOpen ? 'open' : 'closed',
          statusLabel: shopStatus.label,
          logoUrl:     shop.logoUrl,
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
    } catch {
      setNearby([]);
      setRecos([]);
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

  const handleNavPress = (t: NavTab) => {
    setNavTab(t);
    if (t === 'favorites') onFavorites?.();
    if (t === 'voice')     onVoice?.();
    if (t === 'messages')  onMessages?.();
    if (t === 'profile')   onProfile?.();
  };

  // Gestion du grid de catégories : 'map' déclenche l'écran carte
  const handleCategorySelect = (id: string, label: string) => {
    if (id === 'map') { onMap?.(); return; }
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
            <SearchBar
              value=""
              onChangeText={() => {}}
              onPress={onSearch}
              onMicPress={onVoice}
            />
          </View>
          <View style={styles.px}>
            <TabSelector active={tab} onChange={setTab} onNearbyPress={onMap} onRecentPress={onRecent} />
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

        {/* Recommandations — boutiques VIP réelles */}
        {recos.length > 0 && (
          <View style={styles.recoSection}>
            <View style={[styles.sectionHead, styles.px]}>
              <Text style={styles.secTitle}>{t.home.recommendations}</Text>
              <Text style={styles.secLink}>VIP</Text>
            </View>
            <RecoCarousel
              items={recos}
              onPress={(id) => {
                const shop = recos.find(r => r.id === id);
                if (shop) onShopPress?.(id, shop.name);
              }}
            />
          </View>
        )}

        {/* Boutiques à proximité */}
        <View style={styles.px}>
          <View style={styles.sectionHead}>
            <Text style={styles.secTitle}>{t.home.nearby}</Text>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.accent} />
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

    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  px:     { paddingHorizontal: 20 },
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
  secLink: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },
  recoSection: { marginTop: 28, marginBottom: 8 },
  loader: { paddingVertical: 32, alignItems: 'center' },
  empty:  { paddingVertical: 24, alignItems: 'center' },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
