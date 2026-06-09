import React, { useState, useEffect } from 'react';
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
import OpeningHoursCard from '../../components/store/OpeningHoursCard';
import { colors, fonts, radius } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { StoreProduct } from '../../types/store';
import { ProductPromoInfo } from '../../types/promotions';
import useShopStore from '../../store/shopStore';
import useAuthStore from '../../store/authStore';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import * as storageService from '../../services/storage';
import * as promoService from '../../services/promotions';
import { getErrorMessage } from '../../utils/errorUtils';
import LoadingSpinner from '../../components/LoadingSpinner';

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
}

// ─── Écran ────────────────────────────────────────────────────────────────────

const MAX_GALLERY = 5;

export default function StoreScreen({ onBack, onPreview, onPromos }: Props) {
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

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const [activeCat, setActiveCat] = useState('petitdej');
  const [editTarget, setEditTarget] = useState<StoreProduct | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  // ── Promos actives (pour badges sur les produits) ─────────────────────────
  const [promoMap, setPromoMap] = useState<Record<string, ProductPromoInfo>>({});

  // ── Géolocalisation ────────────────────────────────────────────────────────
  const [locLoading, setLocLoading] = useState(false);
  const [locZone, setLocZone] = useState<string | null>(null);

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

  const activeCatData = categories.find(c => c.id === activeCat);
  const filtered = products.filter(p => p.category === activeCat);
  const openEdit = (p: StoreProduct) => {
    setEditTarget(p);
    setShowSheet(true);
  };
  const openAdd = () => {
    setEditTarget(null);
    setShowSheet(true);
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

  const handleCaptureLocation = async () => {
    setLocLoading(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert(
          'Permission refusée',
          'Autorise LASSİ à accéder à ta position dans les réglages.',
        );
        return;
      }
      await useShopStore.getState().updateLocation(coords.latitude, coords.longitude);
      const zone = await reverseGeocode(coords.latitude, coords.longitude);
      setLocZone(zone);
      Alert.alert('Position enregistrée ✓', `Ton commerce est localisé à : ${zone}`);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la position. Réessaie.");
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

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (shopNotFound) {
    return (
      <View style={styles.root}>
        <StoreHeader onBack={onBack} onPreview={onPreview ?? (() => {})} onPromos={onPromos} />
        <View style={styles.loader}>
          <Text style={styles.notFoundTxt}>
            Ta vitrine n'a pas encore été créée.{'\n'}
            Cela peut arriver si ton inscription s'est interrompue.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadMyShop()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backLinkTxt}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
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

            {/* ── Catalogue ────────────────────────────────────────────────── */}
            <CategoryTabs
              categories={categories}
              active={activeCat}
              onSelect={setActiveCat}
              onAddCat={addCategory}
              onDeleteCat={handleDeleteCat}
            />

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

            <TouchableOpacity style={styles.addProd} onPress={openAdd} activeOpacity={0.8}>
              <IcoPlus />
              <Text style={styles.addProdTxt}>{addItemLabel}</Text>
            </TouchableOpacity>

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
                    ? `📍 ${locZone} — Mettre à jour`
                    : "Définir l'emplacement de ma boutique"}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
      )}

      <AddProductSheet
        visible={showSheet}
        product={editTarget}
        categories={categories}
        onSave={saveProduct}
        onDelete={editTarget ? () => handleDeleteProduct(editTarget.id) : undefined}
        onClose={() => setShowSheet(false)}
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
});
