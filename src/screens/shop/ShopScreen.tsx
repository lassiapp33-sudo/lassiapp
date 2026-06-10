import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import ShopCover from '../../components/shop/ShopCover';
import AvisSection from '../../components/avis/AvisSection';
import useAuthStore from '../../store/authStore';
import ShopIdentity from '../../components/shop/ShopIdentity';
import ShopStats from '../../components/shop/ShopStats';
import ShopInfoBar from '../../components/shop/ShopInfoBar';
import MenuTabs, { MenuTabId } from '../../components/shop/MenuTabs';
import ProductTile, { Product } from '../../components/shop/ProductTile';
import CartFloating from '../../components/shop/CartFloating';
import ShopFooter, { FOOTER_HEIGHT } from '../../components/shop/ShopFooter';
import OpeningHoursCard from '../../components/store/OpeningHoursCard';
import { colors, fonts, TOP_INSET, radius } from '../../theme';
import useCartStore, { OrderType } from '../../store/cartStore';
import useFavoritesStore from '../../store/favoritesStore';
import useLocationStore from '../../store/locationStore';
import * as shopsService from '../../services/shops';
import * as productsService from '../../services/products';
import * as promosService from '../../services/promotions';
import * as terrainsService from '../../services/terrains';
import { Shop } from '../../services/shops';
import { Promotion } from '../../types/promotions';
import { reverseGeocode } from '../../services/location';
import { StoreProduct } from '../../types/store';
import { Terrain, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import ShopTerrainSlotPicker, { SlotBookParams } from '../../components/terrain/ShopTerrainSlotPicker';
import logger from '../../utils/logger';
import {
  computeStatus,
  WeekHours,
  formatHour,
  DayKey,
  DEFAULT_WEEK_HOURS,
} from '../../services/hours';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoPhone = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"
      stroke={colors.accent}
    />
  </Svg>
);
const IcoPin2 = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.muted} />
    <Path d="M12 10m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" stroke={colors.muted} />
  </Svg>
);
const IcoFav = ({ on }: { on: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={on ? colors.accent : '#fff'}
      fill={on ? colors.accent : 'none'}
    />
  </Svg>
);

const SLOT_SUBCATS = ['reservation_terrain_foot', 'reservation_terrain_basket'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

function storeProductToProduct(p: StoreProduct): Product {
  return {
    id: p.id,
    emoji: p.emoji,
    photoUrl: p.photoUrl,
    name: p.name,
    desc: p.desc,
    price: p.price,
    category: p.category,
    stock: p.stock,
  };
}

// Correspondance JS Date.getDay() (0=Dim) → DayKey
const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TerrainBookingParams {
  terrain: Terrain;
  prestataireName: string;
}

export interface TerrainDirectBookParams {
  terrainId: string;
  terrainNom: string;
  prestataireId: string;
  prestataireName: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  prixTotal: number;
}

interface Props {
  shopId?: string;
  shopName?: string;
  targetProductId?: string;
  onBack: () => void;
  onChat?: (logoUrl: string | null, isVip: boolean) => void;
  onCheckout?: () => void;
  onBookTerrain?: (params: TerrainBookingParams) => void;
  onBookTerrainDirect?: (params: TerrainDirectBookParams) => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function ShopScreen({ shopId = '', shopName, targetProductId, onBack, onChat, onCheckout, onBookTerrain, onBookTerrainDirect }: Props) {
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [realProducts, setRealProducts] = useState<StoreProduct[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<MenuTabId>('all');
  const [resolvedZone, setResolvedZone] = useState<string>('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const productSectionY = useRef(0);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);

  // Position utilisateur (déjà chargée dans locationStore par ClientHomeScreen)
  const userCoords = useLocationStore(s => s.coords);

  // ── Chargement depuis Supabase ────────────────────────────────────────────
  const loadShop = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [shop, products, promos] = await Promise.all([
        shopsService.getShopById(shopId),
        productsService.getProducts(shopId),
        promosService.getActivePromos(shopId),
      ]);
      setShopData(shop);
      setActivePromos(promos);
      setRealProducts([
        ...products.filter(p => p.stock === 'in'),
        ...products.filter(p => p.stock === 'out'),
      ]);
      const isSlotCat = (shop?.subcategories ?? []).some(s => SLOT_SUBCATS.includes(s));
      if ((shop?.shopType === 'terrains' || isSlotCat) && shop?.merchantId) {
        const terrainList = await terrainsService.getTerrainsByMerchant(shop.merchantId).catch(() => []);
        setTerrains(terrainList);
      }
      if (shop?.zone) {
        setResolvedZone(shop.zone);
      } else if (shop?.latitude && shop?.longitude) {
        reverseGeocode(shop.latitude, shop.longitude)
          .then(z => setResolvedZone(z))
          .catch(() => {});
      }
    } catch (err) {
      logger.warn('[ShopScreen] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // Quand un produit cible est fourni (depuis PromoBanner), filtre sur sa catégorie et s'y positionne
  useEffect(() => {
    if (!targetProductId || realProducts.length === 0) return;
    const target = realProducts.find(p => p.id === targetProductId);
    if (!target) return;

    setActiveTab(target.category as MenuTabId);
    setHighlightId(targetProductId);

    const scrollTimer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: productSectionY.current, animated: true });
    }, 350);
    const clearTimer = setTimeout(() => setHighlightId(null), 2800);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [targetProductId, realProducts]);

  // ── Type de vitrine ───────────────────────────────────────────────────────
  const shopType = shopData?.shopType ?? 'products';
  const isTerrainShop = shopType === 'terrains';
  const isSlotShop = (shopData?.subcategories ?? []).some(s => SLOT_SUBCATS.includes(s));

  // ── Données dérivées ──────────────────────────────────────────────────────
  const displayName = shopData?.name ?? shopName ?? 'Boutique';
  const displayInitial = displayName.charAt(0).toUpperCase();
  const displayLogoUrl = shopData?.logoUrl ?? undefined;
  const displayZone = resolvedZone;
  const isVip = shopData?.isVip ?? false;
  const reviewsCount = shopData?.reviewsCount ?? 0;
  const ordersCount = shopData?.ordersCount ?? 0;
  const rating = shopData?.rating ?? 0;
  const createdAt = shopData?.createdAt ?? new Date().toISOString();

  // ── Statut d'ouverture dynamique ─────────────────────────────────────────
  const shopHours = (shopData?.openingHours as WeekHours | null) ?? null;
  const manuallyClose = shopData?.isManuallyClose ?? false;
  const status = computeStatus(shopHours, manuallyClose);
  const isOpen = status.isOpen;

  // Plage horaire du jour courant ("7h – 22h") — basée sur les horaires réels du prestataire
  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
  const effectiveHours: WeekHours = shopHours
    ? ({ ...DEFAULT_WEEK_HOURS, ...shopHours } as WeekHours)
    : DEFAULT_WEEK_HOURS;
  const todayDay = shopHours ? effectiveHours[todayKey] : null;
  const todayHoursStr =
    todayDay && !todayDay.closed
      ? `${formatHour(todayDay.open)} – ${formatHour(todayDay.close)}`
      : null;

  // ── Distance GPS ──────────────────────────────────────────────────────────
  const shopLat = shopData?.latitude ?? null;
  const shopLng = shopData?.longitude ?? null;
  const shopHasCoords = shopLat !== null && shopLng !== null;

  const distanceText: string | null = (() => {
    if (!shopHasCoords) return null;
    if (!userCoords) return null; // noGps gère ce cas
    const meters = shopsService.calcDistanceMeters(
      userCoords.latitude,
      userCoords.longitude,
      shopLat!,
      shopLng!,
    );
    return shopsService.formatDistance(meters);
  })();

  // true = le commerce a des coords mais l'user n'a pas activé le GPS
  const noGps = shopHasCoords && !userCoords;

  // ── Options "Sur place / À emporter" — masquées pour bakery et stores ────
  const shopCategory = shopData?.category ?? '';
  const noOrderOptions = ['bakery', 'stores'].includes(shopCategory);
  const showOrderOptions = shopType === 'products' && !noOrderOptions;
  const orderOptions = [
    { id: 'place', label: 'Sur place', emoji: '🍽' },
    { id: 'emporter', label: 'À emporter', emoji: '🥡' },
  ];
  const selectedLabel = orderOptions.find(o => o.id === selectedOrder)?.label ?? 'Sur place';

  // Type de service affiché dans la barre d'infos
  const infoBarOrderType =
    shopType === 'services'
      ? 'Sur rendez-vous'
      : shopType === 'memberships'
        ? 'Abonnement'
        : shopType === 'terrains'
          ? 'Réservation'
          : noOrderOptions
            ? ''
            : selectedLabel;

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const catIds = [...new Set(realProducts.map(p => p.category))];
  const tabs = [{ id: 'all', label: 'Tout' }, ...catIds.map(id => ({ id, label: capitalize(id) }))];
  const sections = catIds.map(id => ({ id, label: capitalize(id) }));

  const visibleSections = activeTab === 'all' ? sections : sections.filter(s => s.id === activeTab);

  const emptyLabel =
    shopType === 'services'
      ? "Aucune prestation disponible pour l'instant."
      : shopType === 'memberships'
        ? "Aucune formule disponible pour l'instant."
        : "Aucun produit disponible pour l'instant.";

  // ── Infos pratiques ───────────────────────────────────────────────────────
  const shopPhone = shopData?.phone ?? null;
  const shopAddress = shopData?.addressText ?? null;
  const galleryUrls = shopData?.galleryUrls ?? [];
  const hasGallery = galleryUrls.length > 0;
  const hasInfoSection = !!(shopPhone || shopAddress || shopHours);

  // Index du composant sticky MenuTabs
  const menuTabsStickyIdx = 6 + (hasGallery ? 1 : 0) + (hasInfoSection ? 1 : 0);

  // ── Promos ────────────────────────────────────────────────────────────────
  const productPromoMap = promosService.buildProductPromoMap(activePromos);
  const shopWidePromos = activePromos.filter(
    p => p.cibleType === 'vitrine' || p.cibleType === 'categorie',
  );

  // ── Utilisateur courant ────────────────────────────────────────────────────
  const currentUser = useAuthStore(s => s.user);
  const currentUserId = currentUser?.id;
  const isMerchant = Boolean(shopData?.merchantId && shopData.merchantId === currentUserId);

  // ── Panier ────────────────────────────────────────────────────────────────
  const stableId = shopId || shopName || '';
  const isFav = useFavoritesStore(s => s.favorites.includes(stableId));
  const toggleFav = useFavoritesStore(s => s.toggleFavorite);
  const cartItems = useCartStore(s => s.items);
  const addItem = useCartStore(s => s.addItem);
  const removeItem = useCartStore(s => s.removeItem);
  const selectedOrder = useCartStore(s => s.orderType);
  const setCartOrder = useCartStore(s => s.setOrderType);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = calculerPrixClient(cartItems.reduce((s, i) => s + i.price * i.qty, 0));

  const shopInfo = {
    id: stableId,
    initial: displayInitial,
    name: displayName,
    location: `📍 ${displayZone} · ${selectedLabel}`,
    logoUrl: displayLogoUrl,
    showOrderType: showOrderOptions,
  };

  const addToCart = (p: StoreProduct) => {
    if (p.stock === 'out') return; // garde-fou côté app (le serveur vérifie aussi)
    addItem(shopInfo, { id: p.id, name: p.name, emoji: p.emoji, price: p.price });
  };

  const CART_BAR_H = 56;
  const scrollBotPad = FOOTER_HEIGHT + (cartCount > 0 ? CART_BAR_H + 16 : 0) + 28;
  const cartBottom = FOOTER_HEIGHT + 8;

  if (loadError) {
    return (
      <View style={styles.root}>
        <View style={[styles.errorCtrl, { paddingTop: TOP_INSET + 8 }]}>
          <TouchableOpacity style={styles.backBtnSm} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
        </View>
        <View style={styles.errorCenter}>
          <Text style={styles.errorTitle}>Impossible de charger la fiche</Text>
          <Text style={styles.errorSub}>Vérifie ta connexion et réessaie.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadShop} activeOpacity={0.8}>
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: scrollBotPad, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={tabs.length > 1 ? [menuTabsStickyIdx] : []}
        >
          {/* 0 — Bannière */}
          <ShopCover />

          {/* 1 — Logo chevauchant + badges */}
          <ShopIdentity
            initial={displayInitial}
            logoUrl={displayLogoUrl}
            isVip={isVip}
            isOpen={isOpen}
          />

          {/* 2 — Nom + tagline */}
          <View style={styles.nameRow}>
            <Text style={styles.shopName}>{displayName}</Text>
            <Text style={styles.tagline}>{shopData?.subtitle ?? displayZone}</Text>
          </View>

          {/* Description (si renseignée) */}
          {shopData?.description ? (
            <Text style={styles.shopDesc}>{shopData.description}</Text>
          ) : null}

          {/* 3 — Stats : réputation (Nouveau / Établi / note réelle) + distance */}
          <ShopStats
            rating={rating}
            reviewsCount={reviewsCount}
            ordersCount={ordersCount}
            createdAt={createdAt}
            zone={displayZone}
            distanceText={distanceText}
            noGps={noGps}
          />

          {/* 4 — Galerie photos (si disponible) */}
          {hasGallery && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroll}
            >
              {galleryUrls.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.galleryPhoto} />
              ))}
            </ScrollView>
          )}

          {/* 5 — Barre d'infos : statut horaires + type de service */}
          <ShopInfoBar
            statusLabel={status.label}
            nextChange={status.nextChange}
            todayHours={todayHoursStr}
            orderType={infoBarOrderType}
            isOpen={isOpen}
          />

          {/* 5b — Bandeau promos actives */}
          {shopWidePromos.length > 0 && (
            <View style={styles.promoBanner}>
              <Text style={styles.promoBannerIco}>🏷️</Text>
              <View style={{ flex: 1 }}>
                {shopWidePromos.map(p => (
                  <Text key={p.id} style={styles.promoBannerTxt} numberOfLines={1}>
                    {p.titre}
                    {p.type === 'pourcentage'
                      ? ` · −${p.valeur}%`
                      : p.type === 'montant_fixe'
                        ? ` · −${formatPrice(p.valeur)}`
                        : ''}
                    {p.montantMin > 0 ? ` (dès ${formatPrice(p.montantMin)})` : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 6 — Mode de commande (nourriture uniquement) */}
          {showOrderOptions && (
            <View style={styles.orderRow}>
              {orderOptions.map(opt => {
                const on = opt.id === selectedOrder;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.orderPill, on && styles.orderPillOn]}
                    onPress={() => setCartOrder(opt.id as OrderType)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.orderEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.orderLabel, on && styles.orderLabelOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 7 — Infos pratiques : téléphone, adresse, horaires */}
          {hasInfoSection && (
            <View style={styles.infoSection}>
              {shopPhone && (
                <TouchableOpacity
                  style={styles.phoneBtn}
                  onPress={() => Linking.openURL(`tel:${shopPhone}`)}
                  activeOpacity={0.8}
                >
                  <IcoPhone />
                  <Text style={styles.phoneTxt}>{shopPhone}</Text>
                </TouchableOpacity>
              )}
              {shopAddress && (
                <View style={styles.addressRow}>
                  <IcoPin2 />
                  <Text style={styles.addressTxt}>{shopAddress}</Text>
                </View>
              )}
              {shopHours && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.hoursTitle}>Horaires</Text>
                  <OpeningHoursCard hours={shopHours} isManuallyClose={manuallyClose} readOnly />
                </View>
              )}
            </View>
          )}

          {/* 8 — Onglets catalogue (STICKY) */}
          {tabs.length > 1 && <MenuTabs tabs={tabs} active={activeTab} onPress={setActiveTab} />}

          {/* 9 — Catalogue / Terrains / Créneaux foot-basket */}
          {isSlotShop ? (
            terrains.length > 0 ? (
              <ShopTerrainSlotPicker
                terrain={terrains[0]}
                prestataireName={displayName}
                openingHours={effectiveHours}
                onBook={(p: SlotBookParams) =>
                  onBookTerrainDirect?.({
                    terrainId: p.terrain.id,
                    terrainNom: p.terrain.nom,
                    prestataireId: p.terrain.prestataire_id,
                    prestataireName: p.prestataireName,
                    dateReservation: p.dateReservation,
                    heureDebut: p.heureDebut,
                    heureFin: p.heureFin,
                    dureeHeures: p.dureeHeures,
                    prixTotal: p.prixTotal,
                  })
                }
              />
            ) : (
              <View style={styles.emptyProducts}>
                <Text style={styles.emptyTxt}>Aucun terrain configuré pour l'instant.</Text>
              </View>
            )
          ) : isTerrainShop ? (
            <View>
              <Text style={styles.catTitle}>Terrains disponibles</Text>
              {terrains.length === 0 ? (
                <View style={styles.emptyProducts}>
                  <Text style={styles.emptyTxt}>Aucun terrain disponible pour l'instant.</Text>
                </View>
              ) : (
                <View style={styles.terrainsContainer}>
                  {terrains.map(terrain => (
                    <TouchableOpacity
                      key={terrain.id}
                      style={styles.terrainCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        onBookTerrain?.({ terrain, prestataireName: displayName })
                      }
                    >
                      <View style={styles.terrainTop}>
                        <Text style={styles.terrainEmoji}>{SPORT_EMOJI[terrain.sport_type]}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.terrainNom}>{terrain.nom}</Text>
                          <Text style={styles.terrainSport}>{SPORT_LABEL[terrain.sport_type]}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.terrainPrice}>{formatPrice(terrainsService.calculerPrixAvecMarge(terrain.prix_horaire))}</Text>
                          <Text style={styles.terrainPriceSub}>/ heure</Text>
                        </View>
                      </View>
                      {terrain.description ? (
                        <Text style={styles.terrainDesc} numberOfLines={2}>{terrain.description}</Text>
                      ) : null}
                      <View style={styles.terrainCta}>
                        <Text style={styles.terrainCtaTxt}>Réserver un créneau →</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : realProducts.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyTxt}>{emptyLabel}</Text>
            </View>
          ) : (
            <View onLayout={e => { productSectionY.current = e.nativeEvent.layout.y; }}>
              {visibleSections.map(section => {
                const products = realProducts.filter(p => p.category === section.id);
                if (products.length === 0) return null;
                return (
                  <View key={section.id}>
                    <Text style={styles.catTitle}>{section.label}</Text>
                    <View style={styles.grid}>
                      {toPairs(products).map((pair, i) => (
                        <View key={i} style={styles.gridRow}>
                          {pair.map(product => (
                            <View
                              key={product.id}
                              style={[
                                styles.tileWrapper,
                                product.id === highlightId && styles.tileHighlight,
                              ]}
                            >
                              <ProductTile
                                product={storeProductToProduct(product)}
                                qty={
                                  product.stock === 'out'
                                    ? 0
                                    : (cartItems.find(ci => ci.id === product.id)?.qty ?? 0)
                                }
                                onAdd={() => addToCart(product)}
                                onRemove={() => removeItem(product.id)}
                                promoInfo={productPromoMap[product.id]}
                              />
                            </View>
                          ))}
                          {pair.length === 1 && <View style={styles.tileSpacer} />}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 10 — Avis clients */}
          {stableId && (
            <AvisSection
              shopId={stableId}
              shopName={displayName}
              currentUserId={currentUserId}
              isMerchant={isMerchant}
            />
          )}
        </ScrollView>
      )}

      {/* Overlay de contrôles fixe */}
      <View style={[styles.overlay, { top: TOP_INSET }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.ctrlBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.ctrlRight} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => toggleFav(stableId)}
            activeOpacity={0.8}
          >
            <IcoFav on={isFav} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Panier flottant — masqué pour les terrains */}
      {!isTerrainShop && (
        <CartFloating
          count={cartCount}
          total={cartTotal}
          onPress={cartCount > 0 ? () => onCheckout?.() : () => {}}
          bottom={cartBottom}
        />
      )}

      {/* Footer fixe — bouton adapté au type de vitrine */}
      <ShopFooter
        total={cartTotal}
        hasItems={cartCount > 0}
        shopType={shopType}
        onChat={onChat ? () => onChat(shopData?.logoUrl ?? null, isVip) : undefined}
        onCheckout={onCheckout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  ctrlRight: { flexDirection: 'row', gap: 9 },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10, 11, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  shopDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  orderRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderPillOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  orderEmoji: { fontSize: 15 },
  orderLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  orderLabelOn: { color: colors.bg },

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
  tileWrapper: { flex: 1 },
  tileHighlight: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },

  emptyProducts: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  galleryScroll: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  galleryPhoto: {
    width: 200,
    height: 130,
    borderRadius: 12,
    marginRight: 10,
  },

  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.05)',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(253,207,52,.08)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.25)',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  phoneTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  addressTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    flex: 1,
  },
  hoursTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 8,
  },

  // Terrains
  terrainsContainer: { paddingHorizontal: 20, gap: 14 },
  terrainCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  terrainTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  terrainEmoji: { fontSize: 30 },
  terrainNom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  terrainSport: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  terrainPrice: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },
  terrainPriceSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  terrainDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  terrainCta: {
    marginTop: 10,
    backgroundColor: `${colors.accent}15`,
    borderWidth: 1,
    borderColor: `${colors.accent}35`,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  terrainCtaTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  // Bandeau promotions
  promoBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: `${colors.accent}12`,
    borderWidth: 1,
    borderColor: `${colors.accent}40`,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  promoBannerIco: { fontSize: 16 },
  promoBannerTxt: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },

  // État d'erreur
  errorCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  backBtnSm: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
});
