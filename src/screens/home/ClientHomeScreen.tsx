import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';

import HomeHeader                     from '../../components/home/HomeHeader';
import SearchBar                      from '../../components/home/SearchBar';
import TabSelector, { HomeTab }       from '../../components/home/TabSelector';
import CategoryGrid                   from '../../components/home/CategoryGrid';
import { CatId }                      from '../../components/category/CatNavBar';
import RecoCarousel, { RecoItem }     from '../../components/home/RecoCarousel';
import NearbyCard, { NearbyPlace }    from '../../components/home/NearbyCard';
import BottomNav, { NavTab, NAV_HEIGHT } from '../../components/home/BottomNav';
import { colors, fonts, TOP_INSET } from '../../theme';
import useAuthStore                   from '../../store/authStore';
import useNotificationsStore          from '../../store/notificationsStore';

// ── Données mock ─────────────────────────────────────────────────────────────

const RECOS: RecoItem[] = [
  { id: '1', initial: 'K', name: 'KFC Sénégal',    desc: 'Poulet croustillant · Livraison rapide' },
  { id: '2', initial: 'T', name: 'Tic Tac Resto',  desc: 'Burgers & tacos · Ouvert 24h/24' },
  { id: '3', initial: 'D', name: 'Dakar Burger',   desc: 'Fast-food local · Livraison 20 min' },
];

const NEARBY: NearbyPlace[] = [
  {
    id: '1', name: 'Tangana Chez Modou', category: 'tangana',
    rating: 4.8, distance: '40 m', isVip: true, isFav: true,
    status: 'open', statusLabel: 'Ouvert',
  },
  {
    id: '2', name: 'Boutique Aïda Gaye', category: 'store',
    rating: 4.6, distance: '85 m', isVip: false, isFav: false,
    status: 'open', statusLabel: 'Ouvert',
  },
  {
    id: '3', name: 'Salon Khadija Beauté', category: 'hair',
    rating: 4.9, distance: '120 m', isVip: false, isFav: false,
    status: 'closing', statusLabel: 'Ferme à 20h',
  },
];

// ── Écran ─────────────────────────────────────────────────────────────────────

interface Props {
  onCategoryPress?:  (catId: CatId, title: string) => void;
  onShopPress?:      (shopId: string, shopName: string) => void;
  onSearch?:         () => void;
  onVoice?:          () => void;
  onFavorites?:      () => void;
  onNotifications?:  () => void;
  onProfile?:        () => void;
}

export default function ClientHomeScreen({
  onCategoryPress,
  onShopPress,
  onSearch,
  onVoice,
  onFavorites,
  onNotifications,
  onProfile,
}: Props) {
  const [tab,    setTab]    = useState<HomeTab>('nearby');
  const [navTab, setNavTab] = useState<NavTab>('home');

  // Données utilisateur depuis le store
  const userInitial   = useAuthStore(s => s.user?.initial ?? 'A');
  const unreadCount   = useNotificationsStore(s => s.notifications.filter(n => n.unread).length);

  const handleNavPress = (t: NavTab) => {
    setNavTab(t);
    if (t === 'favorites') onFavorites?.();
    if (t === 'voice')     onVoice?.();
    if (t === 'profile')   onProfile?.();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: TOP_INSET, paddingBottom: NAV_HEIGHT + 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header localisation + avatar (avatar → notifications) */}
        <View style={styles.px}>
          <HomeHeader
            quartier="Grand Dakar"
            initial={userInitial}
            unreadCount={unreadCount}
            onAvatar={onNotifications}
          />
        </View>

        {/* Barre de recherche — appui → SearchScreen ; micro → VoiceAssistant */}
        <View style={styles.px}>
          <SearchBar
            value=""
            onChangeText={() => {}}
            onPress={onSearch}
            onMicPress={onVoice}
          />
        </View>

        {/* Onglets */}
        <View style={styles.px}>
          <TabSelector active={tab} onChange={setTab} />
        </View>

        {/* Catégories */}
        <View style={styles.sectionHead}>
          <Text style={styles.secTitle}>Explore ton quartier</Text>
        </View>
        <View style={styles.px}>
          <CategoryGrid onSelect={(id, title) => onCategoryPress?.(id as CatId, title)} />
        </View>

        {/* Recommandations premium */}
        <View style={styles.recoSection}>
          <View style={[styles.sectionHead, styles.px]}>
            <Text style={styles.secTitle}>✨ Recommandations LASSI</Text>
            <Text style={styles.secLink}>Sponsorisé</Text>
          </View>
          <RecoCarousel items={RECOS} />
        </View>

        {/* Radar de proximité */}
        <View style={styles.px}>
          <View style={styles.sectionHead}>
            <Text style={styles.secTitle}>📍 Tout près de toi</Text>
          </View>
          {NEARBY.map(place => (
            <NearbyCard
              key={place.id}
              place={place}
              onPress={() => onShopPress?.(place.id, place.name)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Barre de navigation fixe */}
      <BottomNav active={navTab} onPress={handleNavPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  px:    { paddingHorizontal: 20 },
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
  secLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  recoSection: {
    marginTop: 28,
    marginBottom: 8,
  },
});
