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
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { IcoPlus } from '../../components/icons';

import StoreHeader from '../../components/store/StoreHeader';
import ShopProfileCard from '../../components/store/ShopProfileCard';
import CategoryTabs from '../../components/store/CategoryTabs';
import ProductRow from '../../components/store/ProductRow';
import AddProductSheet from '../../components/store/AddProductSheet';
import FicheGuideeSheet from '../../components/store/FicheGuideeSheet';
import OpeningHoursCard from '../../components/store/OpeningHoursCard';
import AbonnementOffreRow from '../../components/fitness/AbonnementOffreRow';
import AddAbonnementOffreSheet from '../../components/fitness/AddAbonnementOffreSheet';
import { colors, fonts, radius } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { StoreProduct } from '../../types/store';
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
import { getErrorMessage } from '../../utils/errorUtils';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScanMenuCamera from '../../components/store/ScanMenuCamera';
import { ProduitExtrait } from '../../utils/parsingMenu';

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

// ─── AddMethodPicker : façons d'ajouter un produit ───────────────────────────

function AddMethodPicker({
  label,
  onManuel,
  onFicheGuidee,
  onScan,
}: {
  label: string;
  onManuel: () => void;
  onFicheGuidee: () => void;
  onScan?: () => void;
}) {
  return (
    <View style={styles.addPickerWrap}>
      {/* Option 1 : Scanner le menu (si disponible) */}
      {onScan && (
        <TouchableOpacity
          style={styles.addPickerBtn}
          onPress={onScan}
          activeOpacity={0.82}
        >
          <Text style={styles.addPickerIcon}>📷</Text>
          <View style={styles.addPickerText}>
            <Text style={[styles.addPickerTitle, { color: colors.white }]}>Scanner mon menu</Text>
            <Text style={styles.addPickerSub}>J'ai déjà un menu (photo, carte imprimée)</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Option 2 : Fiche Guidée (recommandée) */}
      <TouchableOpacity
        style={[styles.addPickerBtn, styles.addPickerBtnPrimary]}
        onPress={onFicheGuidee}
        activeOpacity={0.82}
      >
        <Text style={styles.addPickerIcon}>📝</Text>
        <View style={styles.addPickerText}>
          <Text style={styles.addPickerTitle}>Fiche Guidée</Text>
          <Text style={styles.addPickerSub}>Je n'ai pas de menu, on me propose des choix</Text>
        </View>
      </TouchableOpacity>

      {/* Option 3 : Manuel */}
      <TouchableOpacity
        style={styles.addPickerBtn}
        onPress={onManuel}
        activeOpacity={0.82}
      >
        <Text style={styles.addPickerIcon}>✍️</Text>
        <View style={styles.addPickerText}>
          <Text style={[styles.addPickerTitle, { color: colors.white }]}>Ajouter manuellement</Text>
          <Text style={styles.addPickerSub}>Je préfère tout écrire moi-même</Text>
        </View>
      </TouchableOpacity>
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
  onFicheGuidee?: () => void;
  onRelectureMenu?: (produits: ProduitExtrait[]) => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

const MAX_GALLERY = 5;

export default function StoreScreen({ onBack, onPreview, onPromos, onAbonnes, onFicheGuidee, onRelectureMenu }: Props) {
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
  const updateOpeningHours = useShopStore(s => s.updateOpeningHours);
  const toggleManuallyClose = useShopStore(s => s.toggleManuallyClose);
  const saveShopDetails = useShopStore(s => s.saveShopDetails);
  const updateGalleryUrls = useShopStore(s => s.updateGalleryUrls);
  const saveProduct = useShopStore(s => s.saveProduct);
  const removeProduct = useShopStore(s => s.removeProduct);
  const toggleStock = useShopStore(s => s.toggleStock);
  const loadMyShop = useShopStore(s => s.loadMyShop);
  const addCategory = useShopStore(s => s.addCategory);
  const removeCategory = useShopStore(s => s.removeCategory);
  const createMissingShop = useShopStore(s => s.createMissingShop);

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const [activeCat, setActiveCat] = useState('petitdej');
  const [editTarget, setEditTarget] = useState<StoreProduct | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetDefaultCat, setSheetDefaultCat] = useState<string | undefined>(undefined);
  const [scanCameraVisible, setScanCameraVisible] = useState(false);
  const [showFicheGuidee, setShowFicheGuidee] = useState(false);
  const [ficheDefaultCat, setFicheDefaultCat] = useState<string | undefined>(undefined);

  // ── Promos actives (pour badges sur les produits) ─────────────────────────
  const [promoMap, setPromoMap] = useState<Record<string, ProductPromoInfo>>({});

  // ── Onglets fitness (uniquement pour shopType === 'memberships') ───────────
  // 'formules' = catalogue existant | 'abonnements' = nouveau | 'produits' = nouveau
  type FitnessTab = 'formules' | 'abonnements' | 'produits';
  const [fitnessTab, setFitnessTab] = useState<FitnessTab>('formules');
  const [offres,     setOffres]     = useState<FitnessOffre[]>([]);
  const [offresLoading, setOffresLoading] = useState(false);
  const [editOffre, setEditOffre] = useState<FitnessOffre | null>(null);
  const [showOffreSheet, setShowOffreSheet] = useState(false);
  const userId = useAuthStore(s => s.user?.id);

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

  // ── Infos boutique (description / adresse / téléphone) ─────────────────────
  const [desc, setDesc] = useState(profile.description ?? '');
  const [addr, setAddr] = useState(profile.addressText ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsDirty =
    desc !== (profile.description ?? '') ||
    addr !== (profile.addressText ?? '') ||
    phone !== (profile.phone ?? '');

  // Synchronise les champs locaux quand le store se met à jour (après loadMyShop)
  useEffect(() => {
    setDesc(profile.description ?? '');
    setAddr(profile.addressText ?? '');
    setPhone(profile.phone ?? '');
  }, [profile.description, profile.addressText, profile.phone]);

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

  const loadOffres = useCallback(async () => {
    if (!userId || context.shopType !== 'memberships') return;
    setOffresLoading(true);
    try {
      const list = await fitnessService.getMesOffres(userId);
      setOffres(list);
    } catch {
      // Silencieux : les offres restent vides
    } finally {
      setOffresLoading(false);
    }
  }, [userId, context.shopType]);

  useEffect(() => {
    if (fitnessTab === 'abonnements') loadOffres();
  }, [fitnessTab, loadOffres]);

  const activeCatData = categories.find(c => c.id === activeCat);
  const filtered = products.filter(p => p.category === activeCat);
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
  const openFicheGuidee = (defaultCat?: string) => {
    if (onFicheGuidee) { onFicheGuidee(); return; }
    setFicheDefaultCat(defaultCat);
    setShowFicheGuidee(true);
  };

  // Labels adaptatifs selon le shop_type
  const itemLabel =
    context.shopType === 'services'
      ? 'prestation'
      : context.shopType === 'memberships'
        ? 'formule'
        : 'produit';
  const addItemLabel =
    context.shopType === 'services'
      ? 'Ajouter une prestation'
      : context.shopType === 'memberships'
        ? 'Ajouter une formule'
        : 'Ajouter un produit';

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

  const handleSaveManualZone = async () => {
    const zone = manualZoneText.trim();
    if (!zone) return;
    const { shopId } = useShopStore.getState();
    if (!shopId) return;
    setLocLoading(true);
    try {
      await updateShopZoneManual(shopId, zone);
      setLocZone(zone);
      setManualZoneMode(false);
      setManualZoneText('');
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la zone. Réessaie.");
    } finally {
      setLocLoading(false);
    }
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

  const handleDeleteCat = (catId: string) => {
    const count = products.filter(p => p.category === catId).length;
    const doDelete = async () => {
      if (activeCat === catId) {
        const next = categories.find(c => c.id !== catId);
        if (next) setActiveCat(next.id);
      }
      try {
        await removeCategory(catId);
      } catch {
        Alert.alert('Erreur', 'Impossible de supprimer ce menu. Réessaie.');
      }
    };
    if (count > 0) {
      Alert.alert(
        'Supprimer ce menu ?',
        `${count} ${itemLabel}${count > 1 ? 's' : ''} seront déplacés vers le premier menu restant.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: doDelete },
        ],
      );
    } else {
      doDelete();
    }
  };

  const handleSaveDetails = async () => {
    setDetailsLoading(true);
    try {
      await saveShopDetails(desc.trim(), addr.trim(), phone.trim());
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

  // ── Handlers offres abonnement fitness ────────────────────────────────────

  const handleSaveOffre = async (data: {
    nom: string; description: string; prix: number; dureeJours: number;
  }) => {
    if (!userId) return;
    if (editOffre) {
      await fitnessService.updateOffre(editOffre.id, data);
    } else {
      await fitnessService.createOffre(userId, data);
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
              onToggle={async () => {
                try {
                  await updateProfile({ isOpen: !profile.isOpen });
                } catch {
                  Alert.alert('Erreur', 'Impossible de mettre à jour le statut. Réessaie.');
                }
              }}
            />

            {/* ── Infos boutique ──────────────────────────────────────────── */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Infos boutique</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Description</Text>
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

            {/* ── Sélecteur d'onglets fitness (uniquement pour memberships) ── */}
            {context.shopType === 'memberships' && (
              <View style={styles.fitnessTabBar}>
                {(['formules', 'abonnements', 'produits'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.fitnessTab, fitnessTab === tab && styles.fitnessTabActive]}
                    onPress={() => setFitnessTab(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.fitnessTabTxt, fitnessTab === tab && styles.fitnessTabTxtActive]}>
                      {tab === 'formules' ? 'Formules' : tab === 'abonnements' ? 'Abonnements' : 'Produits'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Onglet Formules (existant) OU catalogue non-fitness ───────── */}
            {(context.shopType !== 'memberships' || fitnessTab === 'formules') && (
              <>
                {context.shopType !== 'memberships' && (
                  <CategoryTabs
                    categories={categories}
                    active={activeCat}
                    onSelect={setActiveCat}
                    onAddCat={addCategory}
                    onDeleteCat={handleDeleteCat}
                  />
                )}
                <SectionHead
                  title={context.shopType === 'memberships' ? 'Formules' : (activeCatData?.label ?? '')}
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
                <AddMethodPicker
                  label={addItemLabel}
                  onManuel={() => openAdd(context.shopType === 'memberships' ? 'formules' : undefined)}
                  onFicheGuidee={() => openFicheGuidee(context.shopType === 'memberships' ? 'formules' : undefined)}
                  onScan={() => setScanCameraVisible(true)}
                />
              </>
            )}

            {/* ── Onglet Abonnements (fitness uniquement) ───────────────────── */}
            {context.shopType === 'memberships' && fitnessTab === 'abonnements' && (
              <>
                <SectionHead
                  title="Offres d'abonnement"
                  count={offres.length}
                  itemLabel="offre"
                />
                {offresLoading ? (
                  <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
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
                  style={styles.addProd}
                  onPress={() => { setEditOffre(null); setShowOffreSheet(true); }}
                  activeOpacity={0.8}
                >
                  <IcoPlus />
                  <Text style={styles.addProdTxt}>Ajouter un abonnement</Text>
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
              </>
            )}

            {/* ── Onglet Produits (fitness uniquement) — réutilise le catalogue ─ */}
            {context.shopType === 'memberships' && fitnessTab === 'produits' && (
              <>
                {(() => {
                  const produitsFiltered = products.filter(p => p.category === 'produits');
                  return (
                    <>
                      <SectionHead
                        title="Produits"
                        count={produitsFiltered.length}
                        itemLabel="produit"
                      />
                      {produitsFiltered.map(product => (
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
                  );
                })()}
                <AddMethodPicker
                  label="Ajouter un produit"
                  onManuel={() => openAdd('produits')}
                  onFicheGuidee={() => openFicheGuidee('produits')}
                  onScan={() => setScanCameraVisible(true)}
                />
              </>
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
                  placeholder="Ex : Guédiawaye, Parcelles Assainies…"
                  placeholderTextColor={colors.muted}
                  value={manualZoneText}
                  onChangeText={setManualZoneText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveManualZone}
                />
                <View style={styles.manualZoneActions}>
                  <TouchableOpacity
                    style={[styles.manualZoneBtn, styles.manualZoneBtnCancel]}
                    onPress={() => setManualZoneMode(false)}
                  >
                    <Text style={styles.manualZoneBtnTxtCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.manualZoneBtn, { opacity: manualZoneText.trim() ? 1 : 0.4 }]}
                    onPress={handleSaveManualZone}
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
        categories={categories}
        defaultCatId={sheetDefaultCat}
        onSave={saveProduct}
        onDelete={editTarget ? () => handleDeleteProduct(editTarget.id) : undefined}
        onClose={() => setShowSheet(false)}
      />

      <FicheGuideeSheet
        visible={showFicheGuidee}
        categories={categories}
        defaultCatId={ficheDefaultCat}
        onSave={saveProduct}
        onClose={() => setShowFicheGuidee(false)}
      />

      <AddAbonnementOffreSheet
        visible={showOffreSheet}
        offre={editOffre}
        onSave={handleSaveOffre}
        onDelete={editOffre ? handleDeleteOffre : undefined}
        onClose={() => setShowOffreSheet(false)}
      />

      <ScanMenuCamera
        visible={scanCameraVisible}
        onDone={items => {
          setScanCameraVisible(false);
          onRelectureMenu?.(items);
        }}
        onClose={() => setScanCameraVisible(false)}
      />
    </LassiScreen>
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

  // Onglets fitness
  fitnessTabBar: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 4,
    marginTop: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  fitnessTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  fitnessTabActive: {
    backgroundColor: colors.accent,
  },
  fitnessTabTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 12.5,
  },
  fitnessTabTxtActive: {
    color: colors.bg,
  },

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

  // AddMethodPicker
  addPickerWrap: {
    marginHorizontal: 18,
    marginTop: 2,
    flexDirection: 'row',
    gap: 10,
  },
  addPickerBtn: {
    flex: 1,
    height: 64,
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
});
