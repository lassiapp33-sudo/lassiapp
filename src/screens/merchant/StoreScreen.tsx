import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { IcoPlus } from '../../components/icons';

import StoreHeader from '../../components/store/StoreHeader';
import ShopProfileCard from '../../components/store/ShopProfileCard';
import CategoryTabs from '../../components/store/CategoryTabs';
import ProductRow from '../../components/store/ProductRow';
import AddProductSheet from '../../components/store/AddProductSheet';
import OpeningHoursCard from '../../components/store/OpeningHoursCard';
import AbonnementOffreRow from '../../components/fitness/AbonnementOffreRow';
import AddAbonnementOffreSheet from '../../components/fitness/AddAbonnementOffreSheet';
import { colors, fonts, radius } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { StoreProduct, StoreCategory } from '../../types/store';
import { ProductPromoInfo } from '../../types/promotions';
import useShopStore from '../../store/shopStore';
import useAuthStore from '../../store/authStore';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import { updateShopZoneManual } from '../../services/shops';
import { CATEGORIES } from '../../config/categories';
import * as storageService from '../../services/storage';
import * as promoService from '../../services/promotions';
import * as fitnessService from '../../services/fitnessAbonnements';
import { FitnessOffre } from '../../services/fitnessAbonnements';
import * as beautyService from '../../services/beauty';
import { BeautyService } from '../../types/beauty';
import { getErrorMessage } from '../../utils/errorUtils';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FITNESS_SUBSCRIPTION_CATS } from '../../config/fitnessConfig';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoPin = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Path d="M12 10m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" stroke={colors.accent} />
  </Svg>
);

// ─── AddMenuSection : ajout manuel simple au menu ────────────────────────────

function AddMenuSection({
  sectionTitle,
  addLabel,
  onAdd,
}: {
  sectionTitle: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <View>
      <Text style={styles.menuSectionTitle}>{sectionTitle}</Text>
      <View style={styles.addPickerWrap}>
        <TouchableOpacity
          style={[styles.addPickerBtn, styles.addPickerBtnPrimary]}
          onPress={onAdd}
          activeOpacity={0.85}
        >
          <Text style={styles.addPickerIcon}>+</Text>
          <Text style={styles.addPickerTitle}>{addLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SectionHead (label adapté au shop_type) ──────────────────────────────────

function SectionHead({
  title,
  count,
  itemLabel,
}: {
  title: string;
  count: number;
  itemLabel: string;
}) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>
        {count} {itemLabel}
        {count > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onPreview?: () => void;
  onPromos?: () => void;
  onAbonnes?: () => void;
  onManageBeautyServices?: () => void;
  onBeautyReservations?: () => void;
  onRestaurantReservations?: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

const MAX_GALLERY = 5;

export default function StoreScreen({ onBack, onPreview, onPromos, onAbonnes, onManageBeautyServices, onBeautyReservations, onRestaurantReservations }: Props) {
  const profileRaw = useShopStore(s => s.profile);
  const avatarUrl = useAuthStore(s => s.user?.avatarUrl);
  const profile = { ...profileRaw, logoUrl: avatarUrl ?? profileRaw.logoUrl ?? undefined };
  const context = useShopStore(s => s.context);
  const shopId = useShopStore(s => s.shopId);
  const shopNotFound = useShopStore(s => s.shopNotFound);
  const categories = useShopStore(s => s.categories);
  const products = useShopStore(s => s.products);
  const loading = useShopStore(s => s.loading);
  const updateProfile = useShopStore(s => s.updateProfile);
  const updateLogo = useShopStore(s => s.updateLogo);
  const updateOpeningHours = useShopStore(s => s.updateOpeningHours);
  const toggleManuallyClose = useShopStore(s => s.toggleManuallyClose);
  const saveShopDetails = useShopStore(s => s.saveShopDetails);
  const updateGalleryUrls = useShopStore(s => s.updateGalleryUrls);
  const saveProduct = useShopStore(s => s.saveProduct);
  const removeProduct = useShopStore(s => s.removeProduct);
  const toggleStock = useShopStore(s => s.toggleStock);
  const loadMyShop = useShopStore(s => s.loadMyShop);
  const removeCategory = useShopStore(s => s.removeCategory);
  const purgeCategoryAndProducts = useShopStore(s => s.purgeCategoryAndProducts);
  const renameCategory = useShopStore(s => s.renameCategory);
  const createMissingShop = useShopStore(s => s.createMissingShop);
  const updateReservationEnabled = useShopStore(s => s.updateReservationEnabled);

  // ── Réservations beauté : uniquement Barber/Tresses/Esthétique ────────────
  // Parfumerie & Soins/Bio = vente produits, pas de créneaux/réservations.
  const BEAUTY_SLOT_SUBCATS = ['hommes', 'femmes', 'esthetique'];
  const isBeautySlotShop =
    context.shopType === 'services' &&
    (context.subcategories ?? []).some(s => BEAUTY_SLOT_SUBCATS.includes(s));

  // Parfumerie & Soins/Bio : shopType services mais vente de produits (pas de prestations).
  const BEAUTY_PRODUCT_SUBCATS = ['parfumerie', 'soins_bio'];
  const isBeautyProductShop =
    context.shopType === 'services' &&
    (context.subcategories ?? []).some(s => BEAUTY_PRODUCT_SUBCATS.includes(s));

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const [activeCat, setActiveCat] = useState('petitdej');
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameText, setRenameText] = useState('');
  const [editTarget, setEditTarget] = useState<StoreProduct | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetDefaultCat, setSheetDefaultCat] = useState<string | undefined>(undefined);

  // ── Promos actives (pour badges sur les produits) ─────────────────────────
  const [promoMap, setPromoMap] = useState<Record<string, ProductPromoInfo>>({});

  // ── Onglets fitness (uniquement pour shopType === 'memberships') ───────────
  const [offres, setOffres] = useState<FitnessOffre[]>([]);
  const [offresLoading, setOffresLoading] = useState(false);
  const [editOffre, setEditOffre] = useState<FitnessOffre | null>(null);
  const [showOffreSheet, setShowOffreSheet] = useState(false);
  const userId = useAuthStore(s => s.user?.id);

  // ── Services réservables (beauté) — table beauty_services ──────────────────
  const [reservServices, setReservServices] = useState<BeautyService[]>([]);

  // ── Récupération vitrine manquante ────────────────────────────────────────
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryCatId, setRecoveryCatId] = useState(CATEGORIES[0]?.id ?? '');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // ── Géolocalisation ────────────────────────────────────────────────────────
  const [locLoading, setLocLoading] = useState(false);
  const [locZone, setLocZone] = useState<string | null>(null);
  const [manualZoneMode, setManualZoneMode] = useState(false);
  const [manualZoneText, setManualZoneText] = useState('');
  const [zoneSuggestions, setZoneSuggestions] = useState<{ label: string; detail: string }[]>([]);
  const [zoneSearching, setZoneSearching] = useState(false);

  // ── Logo boutique ──────────────────────────────────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false);

  const handleEditLogo = () => {
    if (!shopId) return;
    const doUpload = async (source: 'gallery' | 'camera') => {
      const uri = source === 'gallery'
        ? await storageService.pickImageFromGallery()
        : await storageService.pickImageFromCamera();
      if (!uri) return;
      setLogoUploading(true);
      try {
        const path = storageService.logoPath(shopId);
        const url = await storageService.uploadImage('logos', uri, path);
        await updateLogo(url);
      } catch {
        Alert.alert('Erreur', 'Impossible de mettre à jour le logo. Réessaie.');
      } finally {
        setLogoUploading(false);
      }
    };
    if (Platform.OS === 'ios') {
      const { ActionSheetIOS } = require('react-native');
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie', 'Caméra'], cancelButtonIndex: 0 },
        (idx: number) => {
          if (idx === 1) doUpload('gallery');
          if (idx === 2) doUpload('camera');
        },
      );
    } else {
      Alert.alert('Logo boutique', '', [
        { text: 'Galerie', onPress: () => doUpload('gallery') },
        { text: 'Caméra', onPress: () => doUpload('camera') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  // ── Infos boutique (nom / description / adresse / téléphone) ───────────────
  const [name, setName] = useState(profile.name ?? '');
  const [desc, setDesc] = useState(profile.description ?? '');
  const [addr, setAddr] = useState(profile.addressText ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsDirty =
    name.trim() !== (profile.name ?? '') ||
    desc !== (profile.description ?? '') ||
    addr !== (profile.addressText ?? '') ||
    phone !== (profile.phone ?? '');

  // Synchronise les champs locaux quand le store se met à jour (après loadMyShop)
  useEffect(() => {
    setName(profile.name ?? '');
    setDesc(profile.description ?? '');
    setAddr(profile.addressText ?? '');
    setPhone(profile.phone ?? '');
  }, [profile.name, profile.description, profile.addressText, profile.phone]);

  // ── Galerie ───────────────────────────────────────────────────────────────
  const galleryUrls = context.galleryUrls;
  const [galLoading, setGalLoading] = useState(false);

  // Montage seul — loadMyShop est stable (Zustand)
  useEffect(() => {
    loadMyShop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shopId) return;
    promoService
      .getActivePromos(shopId)
      .then(promos => setPromoMap(promoService.buildProductPromoMap(promos)))
      .catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (categories.length > 0 && !categories.find(c => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  // Charge les services réservables (beauté) au montage / retour sur la vitrine
  useEffect(() => {
    if (!isBeautySlotShop || !userId) return;
    beautyService
      .getBeautyServicesByMerchant(userId)
      .then(list => setReservServices(list.filter(s => s.actif)))
      .catch(() => {});
  }, [isBeautySlotShop, userId]);

  const loadOffres = useCallback(async () => {
    if (!userId || context.shopType !== 'memberships') return;
    setOffresLoading(true);
    try {
      const list = await fitnessService.getMesOffres(userId, activeCat);
      setOffres(list);
    } catch {
      // Silencieux : les offres restent vides
    } finally {
      setOffresLoading(false);
    }
  }, [userId, context.shopType, activeCat]);

  useEffect(() => {
    if (context.shopType === 'memberships') loadOffres();
  }, [context.shopType, activeCat, loadOffres]);

  // Auto-suppression des produits shop_items orphelins dans les catégories abonnement fitness
  const cleanupDone = React.useRef(false);
  useEffect(() => {
    if (cleanupDone.current) return;
    if (context.shopType !== 'memberships' || products.length === 0) return;
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const stale = products.filter(p => FITNESS_SUBSCRIPTION_CATS.has(norm(p.category ?? '')));
    if (stale.length === 0) return;
    cleanupDone.current = true;
    Promise.allSettled(stale.map(p => removeProduct(p.id))).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, context.shopType]);

  const normCat = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const activeCatData = categories.find(c => c.id === activeCat);
  const filtered = products.filter(p => normCat(p.category ?? '') === activeCat);

  // ── Boutiques beauté : Services (réservables, table beauty_services) + Produits (shop_items) ──
  // Le sheet manuel ne gère que les produits ; les services passent par l'écran réservations.
  const BEAUTY_PRODUCT_CATS: StoreCategory[] = [
    { id: 'produits', label: 'Produits', emoji: '🛍️' },
  ];
  const beautyProducts = products.filter(p => normCat(p.category ?? '') === 'produits');

  // Libellés presets + regroupement des services réservables par catégorie
  const BEAUTY_CAT_LABELS: Record<string, string> = {
    barber: 'Barber', tresse: 'Tresse', ongle: 'Ongles', general: 'Général',
  };
  const beautyCatLabel = (c: string) =>
    BEAUTY_CAT_LABELS[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Général');
  const reservByCat = React.useMemo(() => {
    const groups: { key: string; label: string; items: BeautyService[] }[] = [];
    for (const svc of reservServices) {
      const key = svc.categorie || 'general';
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, label: beautyCatLabel(key), items: [] }; groups.push(g); }
      g.items.push(svc);
    }
    return groups;
  }, [reservServices]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (p: StoreProduct) => {
    setSheetDefaultCat(undefined);
    setEditTarget(p);
    setShowSheet(true);
  };
  const openAdd = (defaultCat?: string) => {
    setEditTarget(null);
    setSheetDefaultCat(defaultCat);
    setShowSheet(true);
  };
  // Labels adaptatifs selon le shop_type
  const itemLabel =
    isBeautyProductShop
      ? 'produit'
      : context.shopType === 'services'
        ? 'prestation'
        : context.shopType === 'memberships'
          ? 'formule'
          : 'produit';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateMissingShop = async () => {
    const name = recoveryName.trim();
    if (!name) { setRecoveryError('Donne un nom à ta boutique.'); return; }
    const cat = CATEGORIES.find(c => c.id === recoveryCatId);
    if (!cat) return;
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      await createMissingShop(name, cat.id, cat.shopType);
    } catch (e: unknown) {
      setRecoveryError(e instanceof Error ? e.message : 'Erreur inconnue. Réessaie.');
      setRecoveryLoading(false);
    }
  };

  const handleCaptureLocation = async () => {
    setLocLoading(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert(
          'GPS indisponible',
          'Le GPS est inaccessible sur cet appareil. Tu peux saisir ton quartier manuellement.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Saisir manuellement',
              onPress: () => {
                setManualZoneMode(true);
                setManualZoneText('');
              },
            },
          ],
        );
        return;
      }
      await useShopStore.getState().updateLocation(coords.latitude, coords.longitude);
      const zone = await reverseGeocode(coords.latitude, coords.longitude);
      setLocZone(zone);
      setManualZoneMode(false);
      Alert.alert('Position enregistrée ✓', `Ton commerce est localisé à : ${zone}`);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la position. Réessaie.");
    } finally {
      setLocLoading(false);
    }
  };

  const handleSaveManualZone = async (zoneOverride?: string) => {
    const zone = (zoneOverride ?? manualZoneText).trim();
    if (!zone) return;
    const { shopId } = useShopStore.getState();
    if (!shopId) return;
    setLocLoading(true);
    try {
      await updateShopZoneManual(shopId, zone);
      setLocZone(zone);
      setManualZoneMode(false);
      setManualZoneText('');
      setZoneSuggestions([]);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la zone. Réessaie.");
    } finally {
      setLocLoading(false);
    }
  };

  const zoneSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleZoneTextChange = (text: string) => {
    setManualZoneText(text);
    if (zoneSearchTimer.current) clearTimeout(zoneSearchTimer.current);
    if (text.trim().length < 2) { setZoneSuggestions([]); return; }
    zoneSearchTimer.current = setTimeout(async () => {
      setZoneSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&countrycodes=sn&format=json&addressdetails=1&limit=6&accept-language=fr`,
          { headers: { 'User-Agent': 'LassiApp/1.0' } },
        );
        if (!res.ok) return;
        const results = await res.json() as Array<{
          display_name: string;
          address: Record<string, string>;
        }>;
        const suggestions = results.map(r => {
          const a = r.address;
          const label = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village ?? a.town ?? a.city ?? a.county ?? r.display_name.split(',')[0];
          const detail = r.display_name.split(',').slice(0, 3).join(', ');
          return { label: label.trim(), detail };
        }).filter((s, i, arr) => arr.findIndex(x => x.label === s.label) === i);
        setZoneSuggestions(suggestions);
      } catch { /* silence */ } finally {
        setZoneSearching(false);
      }
    }, 350);
  };

  const handleDeleteProduct = (id: string) => {
    Alert.alert('Supprimer ce produit ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeProduct(id);
            setShowSheet(false);
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer ce produit. Réessaie.');
          }
        },
      },
    ]);
  };

  const handleDeleteCat = async (catId: string) => {
    // Protection : abonnés actifs pour un onglet de type abonnement fitness
    if (context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(catId)) {
      try {
        const hasActive = await fitnessService.hasActiveAbonnesForTab(catId);
        if (hasActive) {
          Alert.alert(
            'Suppression impossible',
            "Des abonnements sont encore actifs. Attendez qu'ils expirent avant de supprimer cet onglet.",
          );
          return;
        }
      } catch {
        // Erreur réseau → laisser passer
      }
    }

    const count = products.filter(p => normCat(p.category ?? '') === catId).length;
    const doDelete = async () => {
      if (activeCat === catId) {
        const next = categories.find(c => c.id !== catId);
        if (next) setActiveCat(next.id);
      }
      try {
        // Supprimer les offres d'abonnement liées à cet onglet
        if (context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(catId)) {
          await fitnessService.deleteOffresForTab(catId);
        }
        if (context.shopType === 'memberships') {
          await purgeCategoryAndProducts(catId);
        } else {
          await removeCategory(catId);
        }
      } catch {
        Alert.alert('Erreur', 'Impossible de supprimer cet onglet. Réessaie.');
      }
    };
    if (count > 0) {
      Alert.alert(
        'Supprimer cet onglet ?',
        context.shopType === 'memberships'
          ? `${count} produit${count > 1 ? 's' : ''} ser${count > 1 ? 'ont' : 'a'} supprimé${count > 1 ? 's' : ''} définitivement.`
          : `${count} ${itemLabel}${count > 1 ? 's' : ''} seront déplacés vers le premier onglet restant.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: doDelete },
        ],
      );
    } else {
      doDelete();
    }
  };

  const handleRenameCat = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    setRenameText(cat.label);
    setRenameTarget({ id: catId, label: cat.label });
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameText.trim()) return;
    try {
      await renameCategory(renameTarget.id, renameText.trim());
      const newId = renameText.trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || renameTarget.id;
      setActiveCat(newId);
    } catch {
      Alert.alert('Erreur', 'Impossible de renommer cet onglet. Réessaie.');
    }
    setRenameTarget(null);
  };

  const handleSaveDetails = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Le nom de la boutique ne peut pas être vide.');
      return;
    }
    setDetailsLoading(true);
    try {
      await saveShopDetails(name.trim(), desc.trim(), addr.trim(), phone.trim());
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer les informations. Réessaie.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAddGalleryPhoto = async () => {
    if (!shopId) return;
    if (galleryUrls.length >= MAX_GALLERY) {
      Alert.alert('Limite atteinte', `Tu peux ajouter jusqu'à ${MAX_GALLERY} photos.`);
      return;
    }
    try {
      const uri = await storageService.pickGalleryImage();
      if (!uri) return;
      setGalLoading(true);
      const path = storageService.galleryImagePath(shopId);
      const url = await storageService.uploadImage('gallery', uri, path);
      await updateGalleryUrls([...galleryUrls, url]);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, '');
      if (msg.includes('Bucket not found') || msg.includes('not found')) {
        Alert.alert(
          'Configuration manquante',
          "Le stockage galerie n'est pas encore configuré dans Supabase. Exécute le fichier supabase_gallery_bucket.sql dans le SQL Editor de ton projet.",
        );
      } else {
        Alert.alert('Erreur', "Impossible d'uploader la photo. Vérifie ta connexion et réessaie.");
      }
    } finally {
      setGalLoading(false);
    }
  };

  const handleRemoveGalleryPhoto = (url: string) => {
    Alert.alert('Supprimer cette photo ?', 'Elle ne sera plus visible sur ta fiche.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateGalleryUrls(galleryUrls.filter(u => u !== url));
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer la photo. Réessaie.');
          }
        },
      },
    ]);
  };

  // ── Sauvegarde produit avec auto-création offre pour tabs abonnement ─────

  const handleSaveProduct = async (product: StoreProduct) => {
    if (userId && context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(product.category as string)) {
      // Onglet abonnement fitness : créer UNIQUEMENT l'offre, pas de produit dans la liste
      const isNew = !products.find(p => p.id === product.id);
      if (isNew) {
        try {
          await fitnessService.createOffre(
            userId,
            {
              nom:         product.name,
              description: product.desc ?? '',
              prix:        product.price,
              dureeJours:  30,
            },
            product.category as string,
          );
          await loadOffres();
        } catch {
          Alert.alert('Erreur', "Impossible d'ajouter l'offre. Réessaie.");
        }
      }
    } else {
      await saveProduct(product);
    }
  };

  // ── Handlers offres abonnement fitness ────────────────────────────────────

  const handleSaveOffre = async (data: {
    nom: string; description: string; prix: number; dureeJours: number;
  }) => {
    if (!userId) return;
    if (editOffre) {
      await fitnessService.updateOffre(editOffre.id, data);
    } else {
      // Lier la nouvelle offre à l'onglet actif
      await fitnessService.createOffre(userId, data, activeCat);
    }
    await loadOffres();
  };

  const handleDeleteOffre = async () => {
    if (!editOffre) return;
    try {
      await fitnessService.deleteOffre(editOffre.id);
      setShowOffreSheet(false);
      await loadOffres();
    } catch {
      Alert.alert('Erreur', 'Impossible de supprimer. Des abonnements actifs y font peut-être référence.');
    }
  };

  const handleToggleOffreActif = async (offre: FitnessOffre) => {
    try {
      await fitnessService.updateOffre(offre.id, { actif: !offre.actif });
      setOffres(prev => prev.map(o => o.id === offre.id ? { ...o, actif: !o.actif } : o));
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier le statut. Réessaie.');
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (shopNotFound) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <StoreHeader onBack={onBack} onPreview={onPreview ?? (() => {})} onPromos={onPromos} />
        <ScrollView
          contentContainerStyle={styles.recoveryScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.recoveryTitle}>Finalise ta vitrine</Text>
          <Text style={styles.recoverySubtitle}>
            Ton inscription a été interrompue avant la création de ta boutique.{'\n'}
            Renseigne les informations ci-dessous pour continuer.
          </Text>

          <Text style={styles.recoveryLabel}>Nom de ta boutique</Text>
          <TextInput
            style={styles.recoveryInput}
            placeholder="Ex : Tangana de Coumba"
            placeholderTextColor={colors.muted}
            value={recoveryName}
            onChangeText={t => { setRecoveryName(t); setRecoveryError(null); }}
            autoCorrect={false}
            returnKeyType="done"
          />

          <Text style={styles.recoveryLabel}>Type de commerce</Text>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.recoveryCatRow, recoveryCatId === cat.id && styles.recoveryCatRowOn]}
              onPress={() => setRecoveryCatId(cat.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.recoveryRadio, recoveryCatId === cat.id && styles.recoveryRadioOn]}>
                {recoveryCatId === cat.id && <View style={styles.recoveryRadioDot} />}
              </View>
              <Text style={[styles.recoveryCatLabel, recoveryCatId === cat.id && styles.recoveryCatLabelOn]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}

          {recoveryError && <Text style={styles.recoveryError}>{recoveryError}</Text>}

          <TouchableOpacity
            style={[styles.retryBtn, { opacity: recoveryLoading ? 0.6 : 1 }]}
            onPress={handleCreateMissingShop}
            disabled={recoveryLoading}
            activeOpacity={0.8}
          >
            {recoveryLoading
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.retryTxt}>Créer ma vitrine</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ marginTop: 12 }}>
            <Text style={styles.backLinkTxt}>← Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
    <LassiScreen
      header={
        <StoreHeader onBack={onBack} onPreview={onPreview ?? (() => {})} onPromos={onPromos} />
      }
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Profil + toggle ouvert/fermé */}
            <ShopProfileCard
              profile={profile}
              onEditLogo={logoUploading ? undefined : handleEditLogo}
              onToggle={async () => {
                try {
                  await updateProfile({ isOpen: !profile.isOpen });
                } catch {
                  Alert.alert('Erreur', 'Impossible de mettre à jour le statut. Réessaie.');
                }
              }}
            />

            {/* ── Mon lien de partage ─────────────────────────────────────── */}
            {profile.slug ? (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>Mon lien de partage</Text>
                <View style={styles.card}>
                  <Text style={styles.shareLink} numberOfLines={1}>
                    {`lassi.tech/p/${profile.slug}`}
                  </Text>
                  <Text style={styles.shareHint}>
                    Partagez-le à vos contacts, sur WhatsApp et vos bios réseaux sociaux : vos clients arrivent direct dans votre vitrine pour commander.
                  </Text>
                  <View style={styles.shareRow}>
                    <TouchableOpacity
                      style={[styles.shareBtn, styles.shareBtnGhost]}
                      onPress={async () => {
                        await Clipboard.setStringAsync(`https://lassi.tech/p/${profile.slug}`);
                        Alert.alert('Copié', 'Lien copié dans le presse-papier.');
                      }}
                    >
                      <Text style={styles.shareBtnGhostText}>Copier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shareBtn, styles.shareBtnSolid]}
                      onPress={() =>
                        Share.share({
                          message: `${profile.name} est maintenant sur LASSİ ! 🎉\nCommandez directement ici : https://lassi.tech/p/${profile.slug}`,
                        }).catch(() => {})
                      }
                    >
                      <Text style={styles.shareBtnSolidText}>Partager</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Infos boutique ──────────────────────────────────────────── */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Infos boutique</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Nom de la boutique</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nom affiché aux clients"
                  placeholderTextColor={colors.muted}
                  maxLength={60}
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Description</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldMulti]}
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="Spécialité, ambiance, services proposés…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Adresse</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={addr}
                  onChangeText={setAddr}
                  placeholder="Ex : Rue 10 x 17, Dakar Plateau"
                  placeholderTextColor={colors.muted}
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Téléphone de contact</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="77 XXX XX XX"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />

                {detailsDirty && (
                  <TouchableOpacity
                    style={styles.saveDetailsBtn}
                    onPress={handleSaveDetails}
                    disabled={detailsLoading}
                    activeOpacity={0.85}
                  >
                    {detailsLoading ? (
                      <ActivityIndicator color={colors.bg} size="small" />
                    ) : (
                      <Text style={styles.saveDetailsTxt}>Enregistrer les modifications</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {isBeautySlotShop ? (
              /* ── Beauté (barber/tresse/esthétique/ongle) : format Services / Produits ── */
              <>
                <Text style={styles.menuSectionTitle}>Ajouter au catalogue</Text>
                <View style={styles.addPickerWrap}>
                  <TouchableOpacity
                    style={[styles.addPickerBtn, styles.addPickerBtnPrimary]}
                    onPress={() => onManageBeautyServices?.()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addPickerIcon}>+</Text>
                    <Text style={styles.addPickerTitle}>Service</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPickerBtn}
                    onPress={() => openAdd('produits')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addPickerIcon}>+</Text>
                    <Text style={[styles.addPickerTitle, { color: colors.white }]}>Produit</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Services réservables (créneaux + paiement) groupés par catégorie ── */}
                {reservByCat.map(group => (
                  <React.Fragment key={group.key}>
                    <SectionHead title={group.label} count={group.items.length} itemLabel="service" />
                    {group.items.map(svc => (
                      <TouchableOpacity
                        key={svc.id}
                        style={styles.reservRow}
                        onPress={() => onManageBeautyServices?.()}
                        activeOpacity={0.85}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reservNom}>{svc.nom}</Text>
                          <Text style={styles.reservMeta}>⏱ {svc.duree_minutes} min · réservable</Text>
                        </View>
                        <Text style={styles.reservPrix}>
                          {beautyService.calculerPrixBeauteAvecMarge(svc.prix)} F
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </React.Fragment>
                ))}

                {/* ── Produits (vente directe / panier) — masqué si vide ── */}
                {beautyProducts.length > 0 && (
                  <SectionHead title="Produits" count={beautyProducts.length} itemLabel="produit" />
                )}
                {beautyProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    promoInfo={promoMap[product.id]}
                    onEdit={() => openEdit(product)}
                    onToggleStock={async () => {
                      try {
                        await toggleStock(product.id);
                      } catch {
                        Alert.alert('Erreur', 'Impossible de mettre à jour le stock. Réessaie.');
                      }
                    }}
                  />
                ))}
              </>
            ) : (
              <>
                {/* ── Ajouter un produit (masqué pour les onglets abonnement fitness) ── */}
                {!(context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(activeCat)) && (
                  <AddMenuSection
                    sectionTitle="Mon menu"
                    addLabel={
                      itemLabel === 'prestation'
                        ? 'Ajouter une prestation'
                        : itemLabel === 'formule'
                          ? 'Ajouter une formule'
                          : 'Ajouter un produit'
                    }
                    onAdd={() => openAdd(activeCat)}
                  />
                )}

                {/* ── Onglets unifiés (un seul système pour tous les shop types) ── */}
                <CategoryTabs
                  categories={categories}
                  active={activeCat}
                  onSelect={setActiveCat}
                  onDeleteCat={handleDeleteCat}
                  onRenameCat={handleRenameCat}
                />

                {/* ── Contenu de l'onglet actif (produits — masqué pour onglets abonnement) ── */}
                {!(context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(activeCat)) && (
                  <>
                    <SectionHead
                      title={activeCatData?.label ?? ''}
                      count={filtered.length}
                      itemLabel={itemLabel}
                    />
                    {filtered.map(product => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        promoInfo={promoMap[product.id]}
                        onEdit={() => openEdit(product)}
                        onToggleStock={async () => {
                          try {
                            await toggleStock(product.id);
                          } catch {
                            Alert.alert('Erreur', 'Impossible de mettre à jour le stock. Réessaie.');
                          }
                        }}
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── Offres d'abonnement (uniquement pour les onglets abonnement) ── */}
            {context.shopType === 'memberships' && FITNESS_SUBSCRIPTION_CATS.has(activeCat) && (
              <View style={styles.fitnessSection}>
                <View style={styles.fitnessSectionHeader}>
                  <Text style={styles.fitnessSectionTitle}>Offres d'abonnement</Text>
                  <Text style={styles.fitnessSectionCount}>
                    {offres.length} offre{offres.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {offresLoading ? (
                  <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
                ) : offres.length === 0 ? (
                  <Text style={styles.fitnessEmpty}>Aucune offre d'abonnement créée</Text>
                ) : (
                  offres.map(offre => (
                    <AbonnementOffreRow
                      key={offre.id}
                      offre={offre}
                      onEdit={() => { setEditOffre(offre); setShowOffreSheet(true); }}
                      onToggleActif={() => handleToggleOffreActif(offre)}
                    />
                  ))
                )}
                <TouchableOpacity
                  style={[styles.addProd, { marginTop: 10 }]}
                  onPress={() => { setEditOffre(null); setShowOffreSheet(true); }}
                  activeOpacity={0.8}
                >
                  <IcoPlus />
                  <Text style={styles.addProdTxt}>Ajouter une offre d'abonnement</Text>
                </TouchableOpacity>
                {onAbonnes && (
                  <TouchableOpacity
                    style={[styles.addProd, { marginTop: 8, backgroundColor: 'rgba(253,207,52,.08)', borderColor: 'rgba(253,207,52,.3)' }]}
                    onPress={onAbonnes}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addProdTxt, { color: colors.accent }]}>Voir mes abonnés →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Galerie photos ───────────────────────────────────────────── */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>
                Galerie photos
                <Text style={styles.sectionSub}>
                  {' '}
                  ({galleryUrls.length}/{MAX_GALLERY})
                </Text>
              </Text>
              <View style={styles.galleryRow}>
                {galleryUrls.map(url => (
                  <TouchableOpacity
                    key={url}
                    onLongPress={() => handleRemoveGalleryPhoto(url)}
                    activeOpacity={0.85}
                    style={styles.galleryThumbWrap}
                  >
                    <Image source={{ uri: url }} style={styles.galleryThumb} />
                  </TouchableOpacity>
                ))}

                {galleryUrls.length < MAX_GALLERY && (
                  <TouchableOpacity
                    style={styles.galleryAddBtn}
                    onPress={handleAddGalleryPhoto}
                    disabled={galLoading}
                    activeOpacity={0.8}
                  >
                    {galLoading ? (
                      <ActivityIndicator color={colors.accent} size="small" />
                    ) : (
                      <Text style={styles.galleryAddTxt}>＋</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.galleryHint}>Appui long sur une photo pour la supprimer.</Text>
            </View>

            {/* ── Horaires d'ouverture ─────────────────────────────────────── */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Horaires</Text>
              <OpeningHoursCard
                hours={context.openingHours}
                isManuallyClose={context.isManuallyClose}
                readOnly={false}
                onChange={async h => {
                  try {
                    await updateOpeningHours(h);
                  } catch {
                    Alert.alert('Erreur', 'Impossible de sauvegarder les horaires. Réessaie.');
                  }
                }}
                onToggleManuallyClose={async () => {
                  try {
                    await toggleManuallyClose();
                  } catch {
                    Alert.alert(
                      'Erreur',
                      'Impossible de mettre à jour le statut exceptionnel. Réessaie.',
                    );
                  }
                }}
              />
            </View>

            {/* ── Restaurant : espace de réservation de table ──────────────── */}
            {context.category === 'food' && (
              <>
                <TouchableOpacity
                  style={[styles.addProd, { marginTop: 12 }]}
                  onPress={() => updateReservationEnabled(!context.reservationEnabled).catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addProdTxt}>
                    Réservation de table : {context.reservationEnabled ? 'activée' : 'désactivée'}
                  </Text>
                  <Text style={[styles.addProdTxt, { color: colors.accent, marginLeft: 'auto' }]}>
                    {context.reservationEnabled ? 'Désactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>

                {context.reservationEnabled && (
                  <Text style={styles.resaHint}>
                    Les créneaux de réservation suivent automatiquement vos horaires d'ouverture.
                  </Text>
                )}

                {context.reservationEnabled && onRestaurantReservations && (
                  <TouchableOpacity
                    style={[styles.addProd, { marginTop: 8, backgroundColor: 'rgba(253,207,52,.08)', borderColor: 'rgba(253,207,52,.3)' }]}
                    onPress={onRestaurantReservations}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.addProdTxt, { color: colors.accent }]}>Mes réservations de table →</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ── Beauté : mes réservations (juste avant l'emplacement) ── */}
            {isBeautySlotShop && onBeautyReservations && (
              <TouchableOpacity
                style={[styles.addProd, { marginTop: 8, backgroundColor: 'rgba(253,207,52,.08)', borderColor: 'rgba(253,207,52,.3)' }]}
                onPress={onBeautyReservations}
                activeOpacity={0.8}
              >
                <Text style={[styles.addProdTxt, { color: colors.accent }]}>Mes réservations →</Text>
              </TouchableOpacity>
            )}

            {/* ── Géolocalisation ──────────────────────────────────────────── */}
            <TouchableOpacity
              style={styles.locBtn}
              onPress={handleCaptureLocation}
              disabled={locLoading}
              activeOpacity={0.8}
            >
              <IcoPin />
              <Text style={styles.locBtnTxt}>
                {locLoading
                  ? 'Localisation…'
                  : locZone
                    ? `${locZone} — Mettre à jour`
                    : "Définir l'emplacement de ma boutique"}
              </Text>
            </TouchableOpacity>

            {manualZoneMode && (
              <View style={styles.manualZoneBox}>
                <TextInput
                  style={styles.manualZoneInput}
                  placeholder="Ex : Grand Mbao, Liberté 5, Thiès…"
                  placeholderTextColor={colors.muted}
                  value={manualZoneText}
                  onChangeText={handleZoneTextChange}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => handleSaveManualZone()}
                />
                {zoneSearching && (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 4 }} />
                )}
                {zoneSuggestions.length > 0 && (
                  <View style={styles.zoneSuggestList}>
                    {zoneSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.zoneSuggestItem}
                        onPress={() => handleSaveManualZone(s.label)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.zoneSuggestLabel}>{s.label}</Text>
                        <Text style={styles.zoneSuggestDetail} numberOfLines={1}>{s.detail}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.manualZoneActions}>
                  <TouchableOpacity
                    style={[styles.manualZoneBtn, styles.manualZoneBtnCancel]}
                    onPress={() => { setManualZoneMode(false); setZoneSuggestions([]); }}
                  >
                    <Text style={styles.manualZoneBtnTxtCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.manualZoneBtn, { opacity: manualZoneText.trim() ? 1 : 0.4 }]}
                    onPress={() => handleSaveManualZone()}
                    disabled={!manualZoneText.trim() || locLoading}
                  >
                    <Text style={styles.manualZoneBtnTxt}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
      )}

      <AddProductSheet
        visible={showSheet}
        product={editTarget}
        categories={isBeautySlotShop ? BEAUTY_PRODUCT_CATS : categories}
        defaultCatId={sheetDefaultCat}
        onSave={handleSaveProduct}
        onDelete={editTarget ? () => handleDeleteProduct(editTarget.id) : undefined}
        onClose={() => setShowSheet(false)}
      />

      <AddAbonnementOffreSheet
        visible={showOffreSheet}
        offre={editOffre}
        onSave={handleSaveOffre}
        onDelete={editOffre ? handleDeleteOffre : undefined}
        onClose={() => setShowOffreSheet(false)}
      />

    </LassiScreen>

    {/* ── Modal renommage catalogue ─────────────────────────────────────── */}
    <Modal
      visible={!!renameTarget}
      transparent
      animationType="fade"
      onRequestClose={() => setRenameTarget(null)}
    >
      <Pressable style={styles.renameOverlay} onPress={() => setRenameTarget(null)}>
        <Pressable style={styles.renameCard} onPress={e => e.stopPropagation()}>
          <Text style={styles.renameTitle}>Renommer mon menu</Text>
          <TextInput
            style={styles.renameInput}
            value={renameText}
            onChangeText={setRenameText}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirmRename}
            placeholderTextColor={colors.muted}
          />
          <View style={styles.renameBtns}>
            <TouchableOpacity style={styles.renameBtnCancel} onPress={() => setRenameTarget(null)}>
              <Text style={styles.renameBtnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.renameBtnOk} onPress={handleConfirmRename}>
              <Text style={styles.renameBtnOkTxt}>Renommer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  recoveryScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  recoveryTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 22,
    marginBottom: 8,
  },
  recoverySubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 28,
  },
  recoveryLabel: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  recoveryInput: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 15,
    marginBottom: 20,
  },
  recoveryCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
    gap: 12,
  },
  recoveryCatRowOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.08)',
  },
  recoveryRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryRadioOn: { borderColor: colors.accent },
  recoveryRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  recoveryCatLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 14,
    flex: 1,
  },
  recoveryCatLabelOn: { color: colors.white },
  recoveryError: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },

  notFoundTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  retryTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  backLinkTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  sectionWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    marginBottom: 10,
  },
  sectionSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // Carte infos boutique
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  shareLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 15,
    fontWeight: '700',
  },
  shareHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  shareBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnGhostText: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  shareBtnSolid: {
    backgroundColor: colors.accent,
  },
  shareBtnSolidText: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  fieldMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveDetailsBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDetailsTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },

  // Galerie
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryThumbWrap: {
    width: 78,
    height: 78,
    borderRadius: 10,
    overflow: 'hidden',
  },
  galleryThumb: {
    width: 78,
    height: 78,
  },
  galleryAddBtn: {
    width: 78,
    height: 78,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  galleryAddTxt: {
    color: colors.accent,
    fontSize: 28,
    lineHeight: 32,
  },
  galleryHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 8,
  },

  // SectionHead catalogue
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  secTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  secCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5 },

  addProd: {
    marginHorizontal: 18,
    marginTop: 2,
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addProdTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  resaHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 },

  reservRow: {
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.28)',
    backgroundColor: 'rgba(253,207,52,.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reservNom: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  reservMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  reservPrix: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },

  locBtn: {
    marginHorizontal: 18,
    marginTop: 10,
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(253,207,52,.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(253,207,52,.05)',
  },
  locBtnTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },

  manualZoneBox: {
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(253,207,52,.05)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.2)',
    padding: 12,
    gap: 10,
  },
  manualZoneInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  manualZoneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  manualZoneBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualZoneBtnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.muted,
  },
  manualZoneBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  manualZoneBtnTxtCancel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  zoneSuggestList: {
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.2)',
    overflow: 'hidden',
  },
  zoneSuggestItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.06)',
  },
  zoneSuggestLabel: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  zoneSuggestDetail: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginTop: 1,
  },

  // Section Offres d'abonnement (fitness)
  fitnessSection: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 4,
    padding: 14,
    backgroundColor: 'rgba(20,21,42,0.8)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.2)',
  },
  fitnessSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fitnessSectionTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  fitnessSectionCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  fitnessEmpty: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center' as const,
    paddingVertical: 10,
  },

  // AddMethodPicker
  menuSectionTitle: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 6,
    fontFamily: fonts.title,
    fontSize: 14,
    color: colors.white,
  },
  addPickerWrap: {
    marginHorizontal: 18,
    marginTop: 2,
    flexDirection: 'row',
    gap: 10,
  },
  addPickerBtn: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
  },
  addPickerBtnPrimary: {
    borderStyle: 'solid',
    borderColor: 'rgba(253,207,52,.5)',
    backgroundColor: 'rgba(253,207,52,.07)',
  },
  addPickerIcon: {
    fontSize: 18,
    color: colors.accent,
  },
  addPickerText: {
    flexShrink: 1,
  },
  addPickerTitle: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  addPickerSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 1,
  },

  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameCard: {
    width: '82%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    gap: 14,
  },
  renameTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    textAlign: 'center',
  },
  renameInput: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  renameBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  renameBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  renameBtnCancelTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  renameBtnOk: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  renameBtnOkTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
