import React, { useState, useEffect, useRef } from 'react';
import logger from '../../utils/logger';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import {
  StoreProduct,
  StoreCategory,
  FormulaPeriod,
  FORMULA_PERIOD_LABELS,
} from '../../types/store';
import * as storageService from '../../services/storage';
import useShopStore from '../../store/shopStore';

// ─── Placeholders adaptatifs ──────────────────────────────────────────────────

function getPlaceholders(
  category: string,
  subcategories: string[],
  shopType: string,
): { namePH: string; descPH: string } {
  const sub = subcategories[0] ?? '';

  if (shopType === 'memberships') {
    if (sub === 'reservation_terrain_foot')
      return { namePH: 'Ex : Terrain foot 1h', descPH: 'Ex : Terrain synthétique 11v11, éclairage inclus' };
    if (sub === 'reservation_terrain_basket')
      return { namePH: 'Ex : Terrain basket 1h', descPH: 'Ex : Terrain couvert, éclairage, 5v5' };
    if (sub === 'arts_martiaux')
      return { namePH: 'Ex : Cours boxe débutant', descPH: 'Ex : 1h par séance, gants fournis' };
    // musculation / fitness (défaut memberships)
    return { namePH: 'Ex : Abonnement mensuel', descPH: 'Ex : Accès illimité salle, vestiaires inclus' };
  }

  if (shopType === 'services') {
    if (sub === 'femmes')
      return { namePH: 'Ex : Tresses vanilles', descPH: 'Ex : Tresses longues, pose ~4h' };
    if (sub === 'esthetique')
      return { namePH: 'Ex : Pose ongles gel', descPH: 'Ex : Pose complète gel, vernis au choix' };
    if (sub === 'parfumerie')
      return { namePH: 'Ex : Eau de parfum 100ml', descPH: 'Ex : Senteur boisée, tenue longue durée' };
    if (sub === 'soins_bio')
      return { namePH: 'Ex : Huile de karité 200ml', descPH: 'Ex : 100% naturelle, hydratation intense' };
    // hommes (défaut services)
    return { namePH: 'Ex : Coupe + dégradé', descPH: 'Ex : Coupe propre, dégradé bas, finition rasoir' };
  }

  // shopType === 'products' — selon la catégorie principale
  if (category === 'tangana') {
    if (sub === 'ndeki')
      return { namePH: 'Ex : Pain Thon Mayo', descPH: 'Ex : Pain garni thon, mayonnaise, oignons' };
    if (sub === 'soupe')
      return { namePH: 'Ex : Soupe kandia', descPH: 'Ex : Soupe gombo, huile de palme, crevettes' };
    return { namePH: 'Ex : Café Touba + Pain', descPH: 'Ex : Café Touba chaud, 1 pain beurré' };
  }
  if (category === 'bakery') {
    if (sub === 'patisserie')
      return { namePH: 'Ex : Gâteau au beurre', descPH: 'Ex : Moelleux chocolat, 6 parts' };
    return { namePH: 'Ex : Baguette tradition', descPH: 'Ex : Baguette croustillante, 250g' };
  }
  if (category === 'food') {
    if (sub === 'fastfood')
      return { namePH: 'Ex : Shawarma poulet', descPH: 'Ex : Wrap poulet grillé, sauce blanche, crudités' };
    if (sub === 'malibu')
      return { namePH: 'Ex : Poisson braisé sauce piment', descPH: 'Ex : Carpe braisée, sauce piment maison' };
    if (sub === 'dibiterie')
      return { namePH: 'Ex : Dibi 500g', descPH: 'Ex : Agneau grillé, oignons, moutarde' };
    if (sub === 'seras')
      return { namePH: 'Ex : Agneau grillé 500g', descPH: 'Ex : Viande grillée, oignons, moutarde' };
    if (sub === 'jus')
      return { namePH: 'Ex : Jus de bouye', descPH: 'Ex : Baobab frais, sucré, 50cl' };
    if (sub === 'snack')
      return { namePH: 'Ex : Kinder Bueno', descPH: 'Ex : Snacks emballés, biscuits, confiseries' };
    // restaurant (défaut food)
    return { namePH: 'Ex : Thiébou dieun', descPH: 'Ex : Riz au poisson, sauce tomate, légumes' };
  }
  if (category === 'fruiterie') {
    if (sub === 'fruits_marines')
      return { namePH: 'Ex : Mangue marinée piment', descPH: 'Ex : Coupé, mariné vinaigre + piment, 200g' };
    return { namePH: 'Ex : Mangues fraîches', descPH: 'Ex : Mangues, bananes, papayes de saison' };
  }
  if (category === 'stores') {
    if (sub === 'habillement')
      return { namePH: 'Ex : T-shirt noir taille M', descPH: 'Ex : Coton 100%, disponible en S/M/L/XL' };
    if (sub === 'quincaillerie')
      return { namePH: 'Ex : Marteau 500g', descPH: 'Ex : Marteau acier forgé, manche bois' };
    return { namePH: 'Ex : Riz parfumé 5kg', descPH: 'Ex : Riz long grain importé, sac 5kg' };
  }

  // Fallback générique
  return { namePH: 'Ex : Nom du produit', descPH: 'Ex : Description courte du produit' };
}

// ─── Suggestions de catégories adaptées à l'activité ──────────────────────────

function getCategorySuggestions(
  category: string,
  subcategories: string[],
  shopType: string,
): string[] {
  const sub = subcategories[0] ?? '';

  if (shopType === 'memberships') {
    if (sub === 'reservation_terrain_foot' || sub === 'reservation_terrain_basket')
      return ['Terrains', 'Créneaux', 'Abonnements'];
    if (sub === 'arts_martiaux')
      return ['Cours', 'Stages', 'Abonnements'];
    return ['Abonnements', 'Cours collectifs', 'Coaching', 'Musculation'];
  }

  if (shopType === 'services') {
    if (sub === 'femmes')
      return ['Tresses', 'Tissages', 'Coloration', 'Soins', 'Produits'];
    if (sub === 'esthetique')
      return ['Ongles', 'Maquillage', 'Soins visage', 'Épilation', 'Produits'];
    if (sub === 'parfumerie')
      return ['Parfums', 'Eaux de toilette', 'Coffrets', 'Déodorants', 'Soins parfumés'];
    if (sub === 'soins_bio')
      return ['Soins visage', 'Soins corps', 'Cheveux', 'Huiles & beurres', 'Savons', 'Bien-être'];
    // hommes (barber) par défaut
    return ['Coupe', 'Barbe', 'Soins', 'Coloration', 'Produits'];
  }

  // shopType === 'products'
  if (category === 'tangana')
    return ['Petit-déjeuner', 'Sandwichs', 'Boissons', 'Soupes'];
  if (category === 'bakery')
    return ['Pains', 'Viennoiseries', 'Pâtisseries', 'Gâteaux'];
  if (category === 'food')
    return ['Entrées', 'Plats', 'Desserts', 'Boissons', 'Accompagnements'];
  if (category === 'fruiterie')
    return ['Fruits', 'Légumes', 'Jus', 'Paniers'];
  if (category === 'stores') {
    if (sub === 'habillement')
      return ['Nouveautés', 'Promos', 'Homme', 'Femme', 'Enfant', 'Chaussures', 'Accessoires'];
    return ['Épicerie', 'Boissons', 'Entretien', 'Quincaillerie'];
  }

  return ['Nouveautés', 'Populaires', 'Promotions'];
}

// Slug identique à shopStore.addCategory (id dérivé du label)
const slugCat = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCamera = () => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"
      stroke={colors.accent}
    />
    <Circle cx={12} cy={13} r={3} stroke={colors.accent} />
  </Svg>
);

const IcoCheck = () => (
  <Svg
    width={19}
    height={19}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

const IcoTrash = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ff5a5a" />
  </Svg>
);

// Emojis disponibles pour illustrer un produit (palette rapide)
const QUICK_EMOJIS = [
  // Nourriture & boissons
  '🥖', '🍳', '🥪', '🍝', '☕', '🍵', '🥤', '🍚',
  '🥘', '🍗', '🍔', '🥗', '🍰', '🧃', '🥐', '🍕',
  '🥩', '🌮', '🍜', '🍱', '🧁', '🍦', '🍺', '🍹',
  '🌽', '🥜', '🧆', '🥙', '🍲', '🫕',
  // Sports & terrains
  '⚽', '🏀', '🎾', '🏐', '🏓', '🥊', '🏋️', '🤸',
  '🚴', '🏊', '🎯', '🏈', '🎱',
  // Beauté & bien-être
  '✂️', '💇', '💅', '💄', '🪒', '🧖', '💆', '🪞',
  '🧴', '🧼', '🌿', '💐',
  // Vêtements & boutique
  '👗', '👟', '👒', '👜', '💍', '🕶️', '🧣', '👔',
  '🛍️', '📦',
  // Services & réparation
  '🔧', '🔨', '📱', '💻', '🔌', '🚗', '🛵', '🧹',
  // Santé
  '💊', '🩺', '🏥',
  // Loisirs & culture
  '🎵', '📚', '🎮', '🖼️', '📸',
];

const BOTTOM_PAD = Platform.OS === 'ios' ? 28 : 14;

// ─── Label de champ ───────────────────────────────────────────────────────────

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={styles.label}>{children}</Text>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  product: StoreProduct | null; // null = nouveau produit
  categories: StoreCategory[];
  defaultCatId?: string;
  /** Données pré-remplies (scan menu). Ignorées si product !== null. */
  prefill?: { name?: string; price?: number; desc?: string };
  onSave: (p: StoreProduct) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export default function AddProductSheet({
  visible,
  product,
  categories,
  defaultCatId,
  prefill,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopType = useShopStore(s => s.context.shopType);
  const shopCategory = useShopStore(s => s.context.category);
  const shopSubcategories = useShopStore(s => s.context.subcategories);
  const addCategory = useShopStore(s => s.addCategory);
  const { namePH, descPH } = getPlaceholders(shopCategory, shopSubcategories, shopType);
  const catSuggestions = getCategorySuggestions(shopCategory, shopSubcategories, shopType);

  const [emoji, setEmoji] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [catId, setCatId] = useState(categories[0]?.id ?? '');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatText, setNewCatText] = useState('');

  // Ajoute (ou réutilise) une catégorie et la sélectionne.
  const handleAddCat = (label?: string) => {
    const raw = (label ?? newCatText).trim();
    if (!raw) { setAddingCat(false); setNewCatText(''); return; }
    const existing = categories.find(c => c.label.toLowerCase() === raw.toLowerCase());
    if (existing) {
      setCatId(existing.id);
    } else {
      addCategory(raw);
      setCatId(slugCat(raw) || `cat_${Date.now()}`);
    }
    setNewCatText('');
    setAddingCat(false);
  };

  // Dériver l'itemType depuis le shopType.
  // Parfumerie & Soins/Bio (shopType services mais vente produits) → toujours produit.
  // Beauté (autres services) : la catégorie "produits" force un vrai produit (pas de durée).
  const isProductServiceShop =
    shopType === 'services' &&
    shopSubcategories.some(s => s === 'parfumerie' || s === 'soins_bio');
  const itemType =
    shopType === 'services'
      ? isProductServiceShop || catId === 'produits'
        ? ('product' as const)
        : ('service' as const)
      : shopType === 'memberships'
        ? ('membership' as const)
        : ('product' as const);
  const [duration, setDuration] = useState('');
  const [formulaPeriod, setFormulaPeriod] = useState<FormulaPeriod>('mois');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isHabillement = shopSubcategories.includes('habillement');
  const TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const COULEURS = ['Blanc', 'Noir', 'Gris', 'Beige', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Violet', 'Rose', 'Marron'];
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const [nameY, setNameY] = useState(0);
  const [descY, setDescY] = useState(0);
  const [priceY, setPriceY] = useState(0);

  const scrollToField = (y: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }, 50);
  };

  // Pré-remplissage à l'ouverture (édition)
  useEffect(() => {
    if (product) {
      setEmoji(product.emoji);
      setPhotoUrl(product.photoUrl);
      setName(product.name);
      setDesc(product.desc);
      setPrice(product.price.toString());
      setCatId(product.category);
      setDuration(product.duration?.toString() ?? '');
      setFormulaPeriod(product.formulaPeriod ?? 'mois');
      setSelectedSizes(product.sizes ?? []);
      setSelectedColors(product.colors ?? []);
    } else {
      setEmoji('');
      setPhotoUrl(undefined);
      setName(prefill?.name ?? '');
      setDesc(prefill?.desc ?? '');
      setPrice(prefill?.price != null ? String(prefill.price) : '');
      setCatId(defaultCatId ?? categories[0]?.id ?? '');
      setDuration('');
      setFormulaPeriod('seance');
      setSelectedSizes([]);
      setSelectedColors([]);
    }
    setShowEmojiPicker(false);
    setUploading(false);
  }, [visible, product, defaultCatId, prefill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sélection et upload de photo ────────────────────────────────────────────
  const handlePickPhoto = async (source: 'gallery' | 'camera') => {
    try {
      const uri =
        source === 'gallery'
          ? await storageService.pickImageFromGallery()
          : await storageService.pickImageFromCamera();

      if (!uri) return;
      if (!shopId) {
        Alert.alert('Erreur', 'Boutique non chargée. Ferme et réouvre la page.');
        return;
      }

      setUploading(true);
      const path = storageService.productImagePath(shopId, product?.id ?? `new_${Date.now()}`);
      const url = await storageService.uploadImage('products', uri, path);
      setPhotoUrl(url);
    } catch (e) {
      logger.error('[upload photo produit]', e);
      Alert.alert('Erreur', "Impossible d'uploader la photo. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  // Affiche le choix galerie/caméra selon la plateforme.
  // Le picker natif ne peut PAS être présenté tant que l'ActionSheet/Alert n'est
  // pas totalement fermé (par-dessus le <Modal> de la fiche) : iOS refuse en
  // silence → « la galerie ne répond pas ». On diffère donc son lancement.
  const deferPick = (source: 'gallery' | 'camera') =>
    setTimeout(() => handlePickPhoto(source), 350);

  const openPhotoPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie', 'Caméra', 'Emoji à la place'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) deferPick('gallery');
          if (idx === 2) deferPick('camera');
          if (idx === 3) {
            setPhotoUrl(undefined);
            setShowEmojiPicker(true);
          }
        },
      );
    } else {
      Alert.alert('Ajouter une photo', '', [
        { text: 'Galerie', onPress: () => deferPick('gallery') },
        { text: 'Caméra', onPress: () => deferPick('camera') },
        {
          text: 'Emoji à la place',
          onPress: () => {
            setPhotoUrl(undefined);
            setShowEmojiPicker(true);
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  // Mode formule = uniquement les abonnements fitness sur l'onglet Formules.
  // Un vrai produit (products, parfumerie, soins/bio, beauté) ne doit jamais être une "formule".
  const isFormuleMode = itemType === 'membership' && catId === 'formules';

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Champ requis', 'Saisis le nom avant de continuer.');
      return;
    }
    if (!price) {
      Alert.alert('Champ requis', 'Saisis un prix avant de continuer.');
      return;
    }
    const p: StoreProduct = {
      id: product?.id ?? `p_${Date.now()}`,
      emoji,
      photoUrl,
      name: name.trim(),
      desc: desc.trim(),
      price: parseInt(price, 10) || 0,
      category: catId,
      stock: product?.stock ?? 'in',
      itemType,
      duration: itemType === 'service' && duration ? parseInt(duration, 10) : undefined,
      formulaPeriod: isFormuleMode && itemType === 'membership' ? formulaPeriod : undefined,
      sizes: isHabillement && selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: isHabillement && selectedColors.length > 0 ? selectedColors : undefined,
    };
    setSaving(true);
    try {
      await onSave(p);
      onClose();
    } catch {
      Alert.alert(
        'Erreur',
        "Impossible d'enregistrer le produit. Vérifie ta connexion et réessaie.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent presentationStyle="overFullScreen" animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        {/* Fond sombre cliquable pour fermer */}
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
          {/* Poignée */}
          <View style={styles.grab} />

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>
              {product
                ? itemType === 'service'
                  ? 'Modifier la prestation'
                  : isFormuleMode
                    ? 'Modifier la formule'
                    : 'Modifier le produit'
                : itemType === 'service'
                  ? 'Nouvelle prestation'
                  : isFormuleMode
                    ? 'Nouvelle formule'
                    : 'Nouveau produit'}
            </Text>

            {/* Zone photo / emoji ─────────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.photoZone, showEmojiPicker && styles.photoZoneEmoji]}
              onPress={showEmojiPicker ? undefined : openPhotoPicker}
              activeOpacity={0.85}
              disabled={showEmojiPicker}
            >
              {uploading ? (
                // Chargement pendant l'upload
                <ActivityIndicator color={colors.accent} size="large" />
              ) : showEmojiPicker ? (
                // Palette d'emojis rapide + option "Aucun" — défilable verticalement
                <ScrollView
                  style={styles.emojiScroll}
                  contentContainerStyle={styles.emojiGrid}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  <TouchableOpacity
                    style={[styles.emojiBtn, !emoji && styles.emojiBtnSel]}
                    onPress={() => {
                      setEmoji('');
                      setShowEmojiPicker(false);
                    }}
                  >
                    <Text style={[styles.emojiTxt, { fontSize: 13, color: colors.muted }]}>✕</Text>
                  </TouchableOpacity>
                  {QUICK_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiBtn, e === emoji && styles.emojiBtnSel]}
                      onPress={() => {
                        setEmoji(e);
                        setShowEmojiPicker(false);
                      }}
                    >
                      <Text style={styles.emojiTxt}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : photoUrl ? (
                // Vraie photo uploadée
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
              ) : emoji ? (
                // Emoji choisi — appuie pour changer
                <>
                  <Text style={styles.bigEmoji}>{emoji}</Text>
                  <Text style={styles.photoHint}>Appuie pour changer</Text>
                </>
              ) : (
                // Rien — zone vide, le prestataire choisit s'il veut
                <>
                  <IcoCamera />
                  <Text style={styles.photoHint}>Appuie pour ajouter une photo ou un emoji</Text>
                  <Text style={styles.photoOptional}>(optionnel)</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Nom ────────────────────────────────────────────────────────── */}
            <View onLayout={e => setNameY(e.nativeEvent.layout.y)}>
              <FieldLabel>Nom du produit</FieldLabel>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={namePH}
                placeholderTextColor="#5a5c80"
                returnKeyType="next"
                onFocus={() => scrollToField(nameY)}
              />
            </View>

            {/* Description ────────────────────────────────────────────────── */}
            <View onLayout={e => setDescY(e.nativeEvent.layout.y)}>
              <FieldLabel>Description courte</FieldLabel>
              <TextInput
                style={[styles.input, { marginBottom: 14 }]}
                value={desc}
                onChangeText={setDesc}
                placeholder={descPH}
                placeholderTextColor="#5a5c80"
                returnKeyType="next"
                onFocus={() => scrollToField(descY)}
              />
            </View>

            {/* Prix ───────────────────────────────────────────────────────── */}
            <View onLayout={e => setPriceY(e.nativeEvent.layout.y)}>
              <FieldLabel>Prix</FieldLabel>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.flex, { marginBottom: 0 }]}
                  value={price}
                  onChangeText={t => setPrice(t.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor="#5a5c80"
                  returnKeyType="done"
                  onFocus={() => scrollToField(priceY)}
                />
                <Text style={styles.fcfaSuffix}>FCFA</Text>
              </View>
            </View>

            {/* Durée — uniquement pour les prestations de service */}
            {itemType === 'service' && (
              <View style={{ marginTop: 14 }}>
                <FieldLabel>Durée estimée (minutes)</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={v => setDuration(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="Ex : 30"
                  placeholderTextColor="#5a5c80"
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Période — uniquement pour les formules (pas les produits) */}
            {isFormuleMode && itemType === 'membership' && (
              <View style={{ marginTop: 14 }}>
                <FieldLabel>Période de la formule</FieldLabel>
                <View style={styles.periodRow}>
                  {(Object.entries(FORMULA_PERIOD_LABELS) as [FormulaPeriod, string | undefined][]).filter(([, label]) => label !== undefined).map(
                    ([key, label]) => {
                      const on = formulaPeriod === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.periodPill, on && styles.periodPillOn]}
                          onPress={() => setFormulaPeriod(key)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.periodTxt, on && styles.periodTxtOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>
            )}

            {/* Catégorie (chips + création) ───────────────────────────────── */}
            <View style={{ marginTop: 14 }}>
              <FieldLabel>Catégorie</FieldLabel>
              <View style={styles.catChipRow}>
                {categories.map(c => {
                  const on = catId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catChip, on && styles.catChipOn]}
                      onPress={() => setCatId(c.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.catChipTxt, on && styles.catChipTxtOn]} numberOfLines={1}>
                        {c.emoji ? `${c.emoji} ` : ''}{c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.catChip, styles.catChipAdd]}
                  onPress={() => setAddingCat(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catChipTxt, styles.catChipAddTxt]}>+ Nouvelle</Text>
                </TouchableOpacity>
              </View>

              {addingCat && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.flex, { marginBottom: 0 }]}
                      value={newCatText}
                      onChangeText={setNewCatText}
                      placeholder="Nom de la catégorie"
                      placeholderTextColor="#5a5c80"
                      maxLength={24}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleAddCat()}
                    />
                    <TouchableOpacity style={styles.catAddOk} onPress={() => handleAddCat()} activeOpacity={0.85}>
                      <Text style={styles.catAddOkTxt}>OK</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Suggestions adaptées à l'activité */}
                  {(() => {
                    const suggs = catSuggestions.filter(
                      s => !categories.some(c => c.label.toLowerCase() === s.toLowerCase()),
                    );
                    if (suggs.length === 0) return null;
                    return (
                      <View style={[styles.catChipRow, { marginTop: 10 }]}>
                        {suggs.map(s => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.catChip, styles.catChipSuggest]}
                            onPress={() => handleAddCat(s)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.catChipTxt, styles.catChipSuggestTxt]}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>

            {/* Tailles & Couleurs — uniquement habillement ───────────────── */}
            {isHabillement && (
              <>
                <View style={{ marginTop: 14 }}>
                  <FieldLabel>Tailles disponibles (optionnel)</FieldLabel>
                  <View style={styles.catChipRow}>
                    {TAILLES.map(t => {
                      const on = selectedSizes.includes(t);
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.sizeChip, on && styles.sizeChipOn]}
                          onPress={() =>
                            setSelectedSizes(prev =>
                              on ? prev.filter(x => x !== t) : [...prev, t],
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.sizeChipTxt, on && styles.sizeChipTxtOn]}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ marginTop: 14 }}>
                  <FieldLabel>Couleurs disponibles (optionnel)</FieldLabel>
                  <View style={styles.catChipRow}>
                    {COULEURS.map(c => {
                      const on = selectedColors.includes(c);
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.sizeChip, on && styles.sizeChipOn]}
                          onPress={() =>
                            setSelectedColors(prev =>
                              on ? prev.filter(x => x !== c) : [...prev, c],
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.sizeChipTxt, on && styles.sizeChipTxtOn]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <View style={{ height: 18 }} />

            {/* Bouton sauvegarder ─────────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.saveBtn, (uploading || saving) && { opacity: 0.5 }]}
              onPress={uploading || saving ? undefined : handleSave}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color={colors.bg} size="small" /> : <IcoCheck />}
              <Text style={styles.saveTxt}>Enregistrer le produit</Text>
            </TouchableOpacity>

            {/* Bouton supprimer — visible uniquement en mode édition */}
            {product && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
                <IcoTrash />
                <Text style={styles.deleteTxt}>Supprimer ce produit</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,24,.65)',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    marginBottom: 18,
  },

  // Zone photo/emoji
  photoZone: {
    height: 130,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  photoZoneEmoji: {
    height: 230,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  emojiScroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  camCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(253,207,52,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 6,
  },
  photoOptional: {
    color: '#3a3c5a',
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  bigEmoji: {
    fontSize: 50,
  },
  photoPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    padding: 8,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnSel: {
    backgroundColor: 'rgba(253,207,52,.2)',
  },
  emojiTxt: { fontSize: 24 },

  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  input: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 14,
  },

  // Ligne Prix + Catégorie
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  fcfaSuffix: {
    position: 'absolute',
    right: 14,
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  // Sélecteur de catégorie (chips + création)
  catChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  catChipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  catChipTxtOn: {
    color: colors.bg,
  },
  catChipAdd: {
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  catChipAddTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
  },
  catChipSuggest: {
    backgroundColor: 'rgba(253,207,52,.08)',
    borderColor: 'rgba(253,207,52,.3)',
  },
  catChipSuggestTxt: {
    color: colors.accent,
  },
  catAddOk: {
    marginLeft: 8,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catAddOkTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },

  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeChipOn: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderColor: colors.accent,
  },
  sizeChipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  sizeChipTxtOn: {
    color: colors.accent,
    fontFamily: fonts.title,
  },

  // Sélecteur de période (memberships)
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodPillOn: {
    backgroundColor: 'rgba(253,207,52,.12)',
    borderColor: colors.accent,
  },
  periodTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  periodTxtOn: {
    color: colors.accent,
  },

  saveBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },

  deleteBtn: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,90,90,.35)',
    backgroundColor: 'rgba(255,90,90,.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  deleteTxt: {
    color: '#ff5a5a',
    fontFamily: fonts.title,
    fontSize: 14,
  },
});

