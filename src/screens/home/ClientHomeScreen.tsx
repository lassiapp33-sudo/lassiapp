import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useT } from '../../i18n';

import HomeHeader from '../../components/home/HomeHeader';
import SearchBar from '../../components/home/SearchBar';
import TabSelector from '../../components/home/TabSelector';
import CategoryGrid from '../../components/home/CategoryGrid';
import { CatId } from '../../components/category/CatNavBar';
import PromoBanner from '../../components/home/PromoBanner';
import NearbyCard, { NearbyPlace } from '../../components/home/NearbyCard';
import SponsoredAdModal from '../../components/home/SponsoredAdModal';
import { SponsoredAd, getActiveSponsoredAds, incrementerContact } from '../../services/sponsoredAds';
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
import { getClientPayments } from '../../services/clientPayments';
import { getMesAbonnements } from '../../services/fitnessAbonnements';
import { getClientOrders } from '../../services/clientOrders';
import { getLivraisonsDemandeur } from '../../services/livraisons';
import { getRecentlyViewed } from '../../services/recentlyViewed';
import { getMyTerrainReservations } from '../../services/terrains';
import { setFastCache } from '../../lib/fastCache';

interface Props {
  onCategoryPress?: (catId: CatId, title: string) => void;
  onShopPress?: (shopId: string, shopName: string) => void;
  onSearch?: () => void;
  onVoice?: () => void;
  onClassement?: () => void;
  onFavorites?: () => void;
  onRecent?: () => void;
  onMessages?: () => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onMap?: () => void;
  onTerrains?: () => void;
  onAlaUneFeed?: () => void;
  onVipListePress?: () => void;
  onShopItemPress?: (shopId: string, shopName: string, productId: string) => void;
  onShopItemView?: (shopId: string, productId: string) => void;
  onContactShop?: (shopId: string, shopName: string, shopLogoUrl: string | null) => void;
}

export default function ClientHomeScreen({
  onCategoryPress,
  onShopPress,
  onSearch,
  onVoice,
  onClassement,
  onFavorites,
  onRecent,
  onMessages,
  onNotifications,
  onProfile,
  onMap,
  onTerrains,
  onAlaUneFeed,
  onVipListePress,
  onShopItemPress,
  onShopItemView,
  onContactShop,
}: Props) {
  const t = useT();

  const [navTab, setNavTab] = useState<NavTab>('home');
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [sponsoredAdModal, setSponsoredAdModal] = useState<SponsoredAd | null>(null);

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

      const currentCoords = useLocationStore.getState().coords;

      const buildPlaces = (badgeMap: Record<string, RecompenseAttribuee>): NearbyPlace[] => {
        const fav = useFavoritesStore.getState().favorites;
        const places = shops.map(shop => {
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
            isFav: fav.includes(shop.id),
            status: shopStatus.isOpen ? 'open' : 'closed',
            statusLabel: shopStatus.label,
            logoUrl: shop.logoUrl,
          } as NearbyPlace;
        });

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
        return places;
      };

      // Phase 1 : boutiques sans badges → affichage immédiat dès que le réseau répond
      setNearby(buildPlaces({}));
      setLoadError(false);
      setLoading(false);

      // Phase 2 : badges en arrière-plan (peut bloquer sur GoTrue au cold start — non bloquant)
      const merchantIds = shops.map(shop => shop.merchantId).filter((id): id is string => !!id);
      if (merchantIds.length > 0) {
        const badgeMap = await Promise.race([
          getBadgesActifsBatch(merchantIds).catch(() => ({}) as Record<string, RecompenseAttribuee>),
          new Promise<Record<string, RecompenseAttribuee>>(resolve =>
            setTimeout(() => resolve({}), 8000),
          ),
        ]);
        setNearby(buildPlaces(badgeMap));
      }
    } catch {
      setNearby([]);
      setLoadError(true);
      setLoading(false);
    }
  }

  // getShops() utilise fetch direct (contourne GoTrue) → loadShops() peut être appelé immédiatement.
  useEffect(() => {
    loadFavorites();
    refreshLocation();
    loadShops();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-charge toutes les données authentifiées en arrière-plan dès que GoTrue libère.
  // Au cold start, GoTrue prend 1-5s. L'utilisateur est sur home → quand il
  // navigue vers n'importe quel écran profil, le cache est déjà prêt.
  useEffect(() => {
    if (!userId) return;
    getClientPayments(userId)
      .then(data => setFastCache(`payments_${userId}`, data))
      .catch(() => {});
    getMesAbonnements(userId)
      .then(data => setFastCache(`abonnements_${userId}`, data))
      .catch(() => {});
    getClientOrders(userId)
      .then(data => setFastCache(`orders_${userId}`, data))
      .catch(() => {});
    getLivraisonsDemandeur()
      .then(data => setFastCache(`livraisons_${userId}`, data))
      .catch(() => {});
    getMyTerrainReservations()
      .then(data => setFastCache(`terrain_res_${userId}`, data))
      .catch(() => {});
    getRecentlyViewed()
      .catch(() => {}); // sauvegarde dans son propre cache rv_cache_${uid}
  }, [userId]);

  // Annonces sponsorisées — modale affichée une seule fois par annonce par compte
  useEffect(() => {
    if (!userId) return;
    // Nettoyer la clé empoisonnée générée si ad.id était undefined (bug RPC RETURNS JSON)
    AsyncStorage.removeItem(`sponsored_seen_ad_${userId}_undefined`).catch(() => {});
    getActiveSponsoredAds(5)
      .then(async ads => {
        for (const ad of ads) {
          if (!ad.id) continue;
          const seenKey = `sponsored_seen_ad_${userId}_${ad.id}`;
          const seen = await AsyncStorage.getItem(seenKey).catch(() => null);
          if (!seen) {
            setSponsoredAdModal(ad);
            return;
          }
        }
      })
      .catch(() => {});
  }, [userId]);

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

  const dismissSponsoredAd = () => {
    if (!sponsoredAdModal || !userId) return;
    const seenKey = `sponsored_seen_ad_${userId}_${sponsoredAdModal.id}`;
    AsyncStorage.setItem(seenKey, '1').catch(() => {});
    setSponsoredAdModal(null);
  };

  const handleSponsoredContact = () => {
    if (!sponsoredAdModal) return;
    dismissSponsoredAd();
    onContactShop?.(sponsoredAdModal.shopId, sponsoredAdModal.shopName ?? '', sponsoredAdModal.shopLogoUrl ?? null);
  };

  const handleSponsoredViewShop = () => {
    if (!sponsoredAdModal) return;
    incrementerContact(sponsoredAdModal.id);
    dismissSponsoredAd();
    onShopPress?.(sponsoredAdModal.shopId, sponsoredAdModal.shopName ?? '');
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
            <SearchBar value="" onChangeText={() => {}} onPress={onSearch} onMicPress={onClassement} />
          </View>
          <View style={styles.px}>
            <TabSelector
              onNearbyPress={onMap}
              onRecentPress={onRecent}
              onAlaUnePress={onAlaUneFeed}
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
        <View style={[styles.sectionHead, { marginTop: 16 }]}>
          <Text style={styles.secTitle}>{t.home.explore}</Text>
        </View>
        <View style={styles.px}>
          <CategoryGrid onSelect={handleCategorySelect} />
        </View>

        {/* Produits en vitrine — carrousel auto-défilant avec indicateurs */}
        <PromoBanner onPress={onShopItemPress} onView={onShopItemView} />

        {/* Établissements 5 Étoiles */}
        {onVipListePress != null && (
          <TouchableOpacity
            style={styles.vipBandeau}
            onPress={onVipListePress}
            activeOpacity={0.82}
          >
            <View style={styles.vipBandeauLeft}>
              <Text style={styles.vipBandeauBadge}>5 ÉTOILES LASSI</Text>
              <Text style={styles.vipBandeauDesc}>Restaurants, spas et instituts de prestige sélectionnés par LASSI</Text>
            </View>
            <Text style={styles.vipBandeauFleche}>›</Text>
          </TouchableOpacity>
        )}

        {/* Boutiques à proximité */}
        <View style={styles.px}>
          <View style={styles.sectionHead}>
            <View style={styles.secTitleRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={colors.accent} />
                <Circle cx={12} cy={9} r={2.5} fill={colors.bg} />
              </Svg>
              <Text style={styles.secTitle}>{t.home.nearby}</Text>
            </View>
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

      {sponsoredAdModal ? (
        <SponsoredAdModal
          ad={sponsoredAdModal}
          onDismiss={dismissSponsoredAd}
          onContact={handleSponsoredContact}
          onViewShop={handleSponsoredViewShop}
        />
      ) : null}
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
  secTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    letterSpacing: -0.2,
  },
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
  vipBandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#0E1420',
  },
  vipBandeauLeft: {
    flex: 1,
    gap: 4,
  },
  vipBandeauBadge: {
    color: '#C9A227',
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 3,
  },
  vipBandeauDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  vipBandeauFleche: {
    color: 'rgba(201,162,39,0.6)',
    fontSize: 24,
    lineHeight: 28,
    marginLeft: 8,
  },
});
