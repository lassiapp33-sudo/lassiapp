import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import ShopCover                       from '../../components/shop/ShopCover';
import ShopIdentity                    from '../../components/shop/ShopIdentity';
import ShopStats                       from '../../components/shop/ShopStats';
import ShopInfoBar                     from '../../components/shop/ShopInfoBar';
import MenuTabs,     { MenuTabId }     from '../../components/shop/MenuTabs';
import ProductTile,  { Product }       from '../../components/shop/ProductTile';
import CartFloating                    from '../../components/shop/CartFloating';
import ShopFooter,   { FOOTER_HEIGHT } from '../../components/shop/ShopFooter';
import { colors, fonts, TOP_INSET, radius } from '../../theme';
import useCartStore                    from '../../store/cartStore';
import useFavoritesStore               from '../../store/favoritesStore';

// ─── Icônes des contrôles fixes ──────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke="#fff" />
    <Path d="M12 19l-7-7 7-7" stroke="#fff" />
  </Svg>
);
const IcoShare = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={18} cy={5} r={3} stroke="#fff" />
    <Circle cx={6} cy={12} r={3} stroke="#fff" />
    <Circle cx={18} cy={19} r={3} stroke="#fff" />
    <Path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" stroke="#fff" />
  </Svg>
);
const IcoFav = ({ on }: { on: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path
      d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={on ? colors.accent : '#fff'}
      fill={on ? colors.accent : 'none'}
    />
  </Svg>
);

// ─── Données mock : profil du commerçant ─────────────────────────────────────

interface ShopDetail {
  initial: string; name: string; tagline: string;
  isVip: boolean; isOpen: boolean;
  rating: number; reviewCount: number;
  distance: string; zone: string; prepTime: string;
  hours: string; orderType: string;
}

const SHOP: ShopDetail = {
  initial:     'D',
  name:        'Tangana Diallo & Frères',
  tagline:     'Petit-déj traditionnel · Pain-œuf, café Touba, spaghetti',
  isVip:       true,
  isOpen:      true,
  rating:      4.9,
  reviewCount: 324,
  distance:    '220 m',
  zone:        'Medina',
  prepTime:    '5-10 min',
  hours:       '06h00 à 11h30',
  orderType:   'À emporter ou sur place',
};

// ─── Catalogue produits ───────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  { id: 'p1',  emoji: '🥖', name: 'Pain Œuf Mayo',     desc: 'Pain croustillant, 2 œufs, mayo',  price: 500,  category: 'petitdej' },
  { id: 'p2',  emoji: '🍳', name: 'Omelette spéciale', desc: '3 œufs, oignons, poivron',         price: 700,  category: 'petitdej' },
  { id: 'p3',  emoji: '🥪', name: 'Pain Viande',       desc: 'Viande hachée épicée, salade',     price: 800,  category: 'petitdej' },
  { id: 'p4',  emoji: '🍝', name: 'Spaghetti matin',   desc: 'Sauce tomate maison, épices',      price: 600,  category: 'petitdej' },
  { id: 'b1',  emoji: '☕', name: 'Café Touba',         desc: 'Bien sucré, épicé, traditionnel', price: 200,  category: 'boissons' },
  { id: 'b2',  emoji: '🍵', name: 'Thé Lipton',        desc: 'Au lait concentré, bien chaud',   price: 250,  category: 'boissons' },
  { id: 'b3',  emoji: '🥤', name: 'Jus Bissap',        desc: 'Hibiscus frais, sucre naturel',   price: 300,  category: 'boissons' },
  { id: 'pl1', emoji: '🍚', name: 'Riz au Poisson',    desc: 'Thiébou djen, légumes, sauce',    price: 1500, category: 'plats'    },
  { id: 'pl2', emoji: '🥘', name: 'Yassa Poulet',      desc: 'Marinade oignon-citron, riz',     price: 1800, category: 'plats'    },
];

// ─── Onglets internes + sections catalogue ────────────────────────────────────

const TABS = [
  { id: 'all'       as MenuTabId, label: 'Tout'         },
  { id: 'petitdej'  as MenuTabId, label: '🍳 Petit-déj'  },
  { id: 'boissons'  as MenuTabId, label: '☕ Boissons'   },
  { id: 'plats'     as MenuTabId, label: '🍽 Plats'      },
];

const SECTIONS: Array<{ id: Product['category']; label: string; emoji: string }> = [
  { id: 'petitdej', label: 'Petit-déjeuner', emoji: '🍳' },
  { id: 'boissons', label: 'Boissons',        emoji: '☕' },
  { id: 'plats',    label: 'Plats',           emoji: '🍽' },
];

// Découpe en paires pour la grille 2 colonnes
function toPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

// ID stable du commerce pour le catalogue et les favoris
const SHOP_ID = 'shop_diallo';

interface Props {
  shopId?:     string;
  onBack:      () => void;
  onChat?:     () => void;
  onCheckout?: () => void;
}

export default function ShopScreen({ shopId = SHOP_ID, onBack, onChat, onCheckout }: Props) {
  const [activeTab, setActiveTab] = useState<MenuTabId>('all');

  // Favoris persistés
  const isFav     = useFavoritesStore(s => s.favorites.includes(shopId));
  const toggleFav = useFavoritesStore(s => s.toggleFavorite);

  // Panier persisté
  const cartItems = useCartStore(s => s.items);
  const addItem   = useCartStore(s => s.addItem);
  const removeItem = useCartStore(s => s.removeItem);

  // Calculs panier depuis le store
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const shopInfo = {
    id:       shopId,
    initial:  SHOP.initial,
    name:     SHOP.name,
    location: `📍 ${SHOP.zone} · ${SHOP.orderType}`,
  };

  const addToCart = (id: string) => {
    const p = PRODUCTS.find(p => p.id === id);
    if (!p) return;
    addItem(shopInfo, { id: p.id, name: p.name, emoji: p.emoji, price: p.price });
  };
  const removeFromCart = (id: string) => removeItem(id);

  const visibleSections = activeTab === 'all'
    ? SECTIONS
    : SECTIONS.filter(s => s.id === activeTab);

  // Espace bas du scroll : footer + panier flottant éventuel
  const CART_BAR_H    = 56;
  const scrollBotPad  = FOOTER_HEIGHT + (cartCount > 0 ? CART_BAR_H + 16 : 0) + 28;
  const cartBottom    = FOOTER_HEIGHT + 8;

  return (
    <View style={styles.root}>

      {/*
       * ── ScrollView du contenu ──────────────────────────────────────────────
       * stickyHeaderIndices={[5]} : l'enfant à l'index 5 (MenuTabs) colle en haut.
       * Enfants directs :
       *   [0] ShopCover  [1] Identity  [2] NameRow  [3] Stats  [4] InfoBar
       *   [5] MenuTabs ← STICKY
       *   [6] Catalogue
       */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: scrollBotPad, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[5]}
      >
        {/* 0 — Bannière (sans boutons — ils sont dans l'overlay fixe ci-dessous) */}
        <ShopCover />

        {/* 1 — Logo chevauchant + badges */}
        <ShopIdentity
          initial={SHOP.initial}
          isVip={SHOP.isVip}
          isOpen={SHOP.isOpen}
        />

        {/* 2 — Nom + tagline */}
        <View style={styles.nameRow}>
          <Text style={styles.shopName}>{SHOP.name}</Text>
          <Text style={styles.tagline}>{SHOP.tagline}</Text>
        </View>

        {/* 3 — Stats : note / distance / temps */}
        <ShopStats
          rating={SHOP.rating}
          reviewCount={SHOP.reviewCount}
          distance={SHOP.distance}
          zone={SHOP.zone}
          prepTime={SHOP.prepTime}
        />

        {/* 4 — Horaires */}
        <ShopInfoBar hours={SHOP.hours} orderType={SHOP.orderType} />

        {/* 5 — Onglets catégories internes (STICKY) */}
        <MenuTabs tabs={TABS} active={activeTab} onPress={setActiveTab} />

        {/* 6 — Grille catalogue */}
        <View>
          {visibleSections.map(section => {
            const products = PRODUCTS.filter(p => p.category === section.id);
            if (products.length === 0) return null;
            return (
              <View key={section.id}>
                <Text style={styles.catTitle}>{section.emoji} {section.label}</Text>
                <View style={styles.grid}>
                  {toPairs(products).map((pair, i) => (
                    <View key={i} style={styles.gridRow}>
                      {pair.map(product => (
                        <ProductTile
                          key={product.id}
                          product={product}
                          qty={cartItems.find(i => i.id === product.id)?.qty ?? 0}
                          onAdd={() => addToCart(product.id)}
                          onRemove={() => removeFromCart(product.id)}
                        />
                      ))}
                      {pair.length === 1 && <View style={styles.tileSpacer} />}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/*
       * ── Overlay de contrôles fixe — HORS du ScrollView ────────────────────
       * pointerEvents="box-none" : le conteneur lui-même ne capte aucun touch,
       * seuls les boutons enfants reçoivent les tapotements.
       * Résultat : scroll normal partout sauf sur les boutons.
       */}
      <View style={[styles.overlay, { top: TOP_INSET }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.ctrlBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.ctrlRight} pointerEvents="box-none">
          <View style={[styles.ctrlBtn, { opacity: 0.45 }]}>
            <IcoShare />
          </View>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => toggleFav(shopId)} activeOpacity={0.8}>
            <IcoFav on={isFav} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Panier flottant — au-dessus du footer */}
      <CartFloating
        count={cartCount}
        total={cartTotal}
        onPress={cartCount > 0 ? () => onCheckout?.() : () => {}}
        bottom={cartBottom}
      />

      {/* Footer fixe : Chat/Vocal + Commander */}
      <ShopFooter
        total={cartTotal}
        hasItems={cartCount > 0}
        onChat={onChat}
        onCheckout={cartCount > 0 ? () => onCheckout?.() : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // ── Overlay boutons (fixe sur l'écran, indépendant du scroll) ────────────
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  ctrlRight: {
    flexDirection: 'row',
    gap: 9,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Contenu ─────────────────────────────────────────────────────────────
  nameRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  shopName: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  tagline: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },
  catTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  grid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tileSpacer: { flex: 1 },
});
