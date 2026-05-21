import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

import TopBar                         from '../../components/category/TopBar';
import CatNavBar, { CatId }           from '../../components/category/CatNavBar';
import SubCatTabs, { SubCat }         from '../../components/category/SubCatTabs';
import VipPodium, { VipEntry }        from '../../components/category/VipPodium';
import FilterBar, { FilterId }        from '../../components/category/FilterBar';
import ShopCard, { Shop }             from '../../components/category/ShopCard';
import SponsoredCard                  from '../../components/category/SponsoredCard';
import BottomNav, { NavTab, NAV_HEIGHT } from '../../components/home/BottomNav';
import { colors, fonts } from '../../theme';

// ── Données mock par catégorie ────────────────────────────────────────────────

const DATA: Record<CatId, {
  title:    string;
  subcats:  SubCat[];
  vip:      VipEntry[];
  shops:    Shop[];
  subLabel: string;
}> = {
  tangana: {
    title: 'Tangana / Ndéki',
    subLabel: 'Tangana',
    subcats: [
      { id: 'tangana', label: '🍳 Tangana' },
      { id: 'ndeki',   label: '🍲 Ndéki'   },
    ],
    vip: [
      { rank: 1, initial: 'D', name: 'Tangana Diallo & Frères', zone: 'Medina' },
      { rank: 2, initial: 'C', name: 'Chez Touty',              zone: 'Parcelles' },
      { rank: 3, initial: 'É', name: 'Étoile de Pikine',        zone: 'Pikine' },
    ],
    shops: [
      { id: '1', initial: 'D', name: 'Tangana Diallo & Frères', isVip: true,  rating: 4.9, status: 'open',    statusLabel: 'Ouvert',       specialty: '🍳 Pain-œuf · Café Touba', distance: '220 m', isFav: true  },
      { id: '2', initial: 'M', name: 'Tangana Chez Modou',      isVip: false, rating: 4.8, status: 'open',    statusLabel: 'Ouvert',       specialty: '🍳 Spaghetti · Omelette',  distance: '40 m',  isFav: false },
      { id: '3', initial: 'A', name: 'Café Touba Assane',       isVip: false, rating: 4.5, status: 'closing', statusLabel: 'Ferme à 11h',  specialty: '🍳 Café · Thé',            distance: '310 m', isFav: false },
      { id: '4', initial: 'F', name: 'Chez Fatou Ndiaye',       isVip: false, rating: 4.7, status: 'open',    statusLabel: 'Ouvert',       specialty: '🍳 Pain-viande',            distance: '450 m', isFav: false },
    ],
  },
  stores: {
    title: 'Commerçants du quartier',
    subLabel: 'Commerçant',
    subcats: [
      { id: 'tous', label: '🏪 Tous' },
    ],
    vip: [
      { rank: 1, initial: 'M', name: 'Mamadou Store',    zone: 'Medina'     },
      { rank: 2, initial: 'A', name: 'Aïda Commerce',    zone: 'Grand Dakar' },
      { rank: 3, initial: 'S', name: 'Souk Sénégal',     zone: 'Pikine'     },
    ],
    shops: [
      { id: '1', initial: 'M', name: 'Mamadou Store',   isVip: true,  rating: 4.8, status: 'open', statusLabel: 'Ouvert', specialty: '🛒 Épicerie · Boissons', distance: '50 m',  isFav: false },
      { id: '2', initial: 'A', name: 'Aïda Commerce',   isVip: false, rating: 4.5, status: 'open', statusLabel: 'Ouvert', specialty: '🛒 Produits locaux',     distance: '180 m', isFav: false },
    ],
  },
  food: {
    title: 'Restos & Boissons',
    subLabel: 'Restaurant',
    subcats: [
      { id: 'resto',    label: '🍽 Restaurants' },
      { id: 'jus',      label: '🥤 Jus local'  },
      { id: 'fastfood', label: '🍔 Fast-Foods'  },
      { id: 'traiteur', label: '🍱 Traiteurs'  },
      { id: 'dibi',     label: '🥩 Dibiteries'  },
      { id: 'serass',   label: '🔥 Sérass'      },
    ],
    vip: [
      { rank: 1, initial: 'R', name: 'Resto du Port',   zone: 'Plateau' },
      { rank: 2, initial: 'T', name: 'Tic Tac Resto',   zone: 'Medina'  },
      { rank: 3, initial: 'K', name: 'KFC Sénégal',     zone: 'Almadies' },
    ],
    shops: [
      { id: '1', initial: 'R', name: 'Resto du Port',  isVip: true,  rating: 4.7, status: 'open',    statusLabel: 'Ouvert',      specialty: '🍽 Poisson · Thiébou', distance: '300 m', isFav: true  },
      { id: '2', initial: 'T', name: 'Tic Tac Resto',  isVip: false, rating: 4.6, status: 'open',    statusLabel: 'Ouvert 24h',  specialty: '🍔 Burgers · Tacos',    distance: '500 m', isFav: false },
      { id: '3', initial: 'K', name: 'KFC Sénégal',    isVip: false, rating: 4.3, status: 'closing', statusLabel: 'Ferme à 23h', specialty: '🍗 Poulet croustillant', distance: '1.2 km', isFav: false },
    ],
  },
  hair: {
    title: 'Coiffeurs & Salons',
    subLabel: 'Salon',
    subcats: [
      { id: 'homme', label: '💈 Hommes' },
      { id: 'femme', label: '💅 Femmes' },
    ],
    vip: [
      { rank: 1, initial: 'K', name: 'Salon Khadija',  zone: 'Medina'     },
      { rank: 2, initial: 'B', name: 'Barber King',    zone: 'Grand Dakar' },
      { rank: 3, initial: 'É', name: 'Élégance Coiff', zone: 'Parcelles'  },
    ],
    shops: [
      { id: '1', initial: 'K', name: 'Salon Khadija Beauté', isVip: true,  rating: 4.9, status: 'open', statusLabel: 'Ouvert', specialty: '💅 Tresses · Extensions', distance: '120 m', isFav: true  },
      { id: '2', initial: 'B', name: 'Barber King',          isVip: false, rating: 4.6, status: 'open', statusLabel: 'Ouvert', specialty: '💈 Coupe · Rasage',      distance: '250 m', isFav: false },
    ],
  },
  sport: {
    title: 'Fitness',
    subLabel: 'Fitness',
    subcats: [
      { id: 'fitness', label: '🏋 Fitness' },
    ],
    vip: [
      { rank: 1, initial: 'F', name: 'FitZone Dakar', zone: 'Plateau'    },
      { rank: 2, initial: 'P', name: 'Power Gym',     zone: 'Grand Dakar' },
      { rank: 3, initial: 'S', name: 'SportLife',     zone: 'Almadies'   },
    ],
    shops: [
      { id: '1', initial: 'F', name: 'FitZone Dakar', isVip: true,  rating: 4.8, status: 'open',    statusLabel: 'Ouvert',      specialty: '🏋 Cardio · Musculation', distance: '400 m', isFav: false },
      { id: '2', initial: 'P', name: 'Power Gym',     isVip: false, rating: 4.5, status: 'closing', statusLabel: 'Ferme à 22h', specialty: '🏋 Cours collectifs',      distance: '650 m', isFav: false },
    ],
  },
  bakery: {
    title: 'Boulangeries',
    subLabel: 'Boulangerie',
    subcats: [
      { id: 'tous', label: '🥖 Toutes' },
    ],
    vip: [
      { rank: 1, initial: 'B', name: 'Boulangerie Diallo', zone: 'Medina'     },
      { rank: 2, initial: 'P', name: 'Pain d\'Or',         zone: 'Plateau'    },
      { rank: 3, initial: 'S', name: 'Saveur du Sahel',    zone: 'Parcelles'  },
    ],
    shops: [
      { id: '1', initial: 'B', name: 'Boulangerie Diallo', isVip: true,  rating: 4.8, status: 'open',    statusLabel: 'Ouvert',      specialty: '🥖 Baguette · Croissant', distance: '80 m',  isFav: false },
      { id: '2', initial: 'P', name: "Pain d'Or",          isVip: false, rating: 4.6, status: 'open',    statusLabel: 'Ouvert',      specialty: '🥐 Viennoiseries',        distance: '200 m', isFav: false },
      { id: '3', initial: 'S', name: 'Saveur du Sahel',    isVip: false, rating: 4.4, status: 'closing', statusLabel: 'Ferme à 20h', specialty: '🥖 Pain local',           distance: '350 m', isFav: false },
    ],
  },
};

// ── Écran ─────────────────────────────────────────────────────────────────────

interface Props {
  initialCatId: CatId;
  onBack:       () => void;
}

export default function CategoryScreen({ initialCatId, onBack }: Props) {
  const [catId,   setCatId]   = useState<CatId>(initialCatId);
  const [subCat,  setSubCat]  = useState<string>(DATA[initialCatId].subcats[0].id);
  const [filter,  setFilter]  = useState<FilterId>('near');
  const [navTab,  setNavTab]  = useState<NavTab>('home');

  const data = DATA[catId];

  // Réinitialise la sous-catégorie lors du changement de catégorie
  const handleCatChange = (id: CatId) => {
    setCatId(id);
    setSubCat(DATA[id].subcats[0].id);
  };

  return (
    <View style={styles.root}>
      {/* Topbar sticky (hors ScrollView) */}
      <TopBar title={data.title} onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: NAV_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Barre de navigation inter-catégories (façon Glovo) */}
        <CatNavBar active={catId} onSelect={handleCatChange} />

        {/* Sous-catégories */}
        <SubCatTabs
          tabs={data.subcats}
          active={subCat}
          onChange={setSubCat}
        />

        {/* Podium Top 3 VIP */}
        <VipPodium
          entries={data.vip}
          subLabel={data.subLabel}
          renewIn="3j"
        />

        {/* Filtres */}
        <FilterBar active={filter} onChange={setFilter} />

        {/* Liste des commerces */}
        <View style={styles.px}>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>Tous les {data.subLabel}</Text>
            <Text style={styles.listCount}>{data.shops.length} près de toi</Text>
          </View>

          {/* Liste avec reco sponsorisée injectée après le 1er item */}
          {data.shops.map((shop, idx) => (
            <React.Fragment key={shop.id}>
              <ShopCard shop={shop} />
              {/* Injection de la reco sponsorisée après le 1er commerce */}
              {idx === 0 && (
                <SponsoredCard
                  initial="T"
                  name="Tic Tac Resto"
                  desc="Petit-déj express · Ouvert 24h/24"
                />
              )}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      {/* Barre de navigation */}
      <BottomNav active={navTab} onPress={setNavTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  px:     { paddingHorizontal: 20 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  listCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
