import React, { useState, useEffect, useRef } from 'react';
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
  onSave: (p: StoreProduct) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export default function AddProductSheet({
  visible,
  product,
  categories,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const shopId = useShopStore(s => s.shopId);
  const shopType = useShopStore(s => s.context.shopType);

  // Dériver l'itemType depuis le shopType
  const itemType =
    shopType === 'services'
      ? ('service' as const)
      : shopType === 'memberships'
        ? ('membership' as const)
        : ('product' as const);

  const [emoji, setEmoji] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [catId, setCatId] = useState(categories[0]?.id ?? '');
  const [duration, setDuration] = useState('');
  const [formulaPeriod, setFormulaPeriod] = useState<FormulaPeriod>('mois');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
    } else {
      setEmoji('');
      setPhotoUrl(undefined);
      setName('');
      setDesc('');
      setPrice('');
      setCatId(categories[0]?.id ?? '');
      setDuration('');
      setFormulaPeriod('mois');
    }
    setShowEmojiPicker(false);
    setUploading(false);
  }, [visible, product]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch {
      Alert.alert('Erreur', "Impossible d'uploader la photo. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  // Affiche le choix galerie/caméra selon la plateforme
  const openPhotoPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie', 'Caméra', 'Emoji à la place'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) handlePickPhoto('gallery');
          if (idx === 2) handlePickPhoto('camera');
          if (idx === 3) {
            setPhotoUrl(undefined);
            setShowEmojiPicker(true);
          }
        },
      );
    } else {
      Alert.alert('Ajouter une photo', '', [
        { text: 'Galerie', onPress: () => handlePickPhoto('gallery') },
        { text: 'Caméra', onPress: () => handlePickPhoto('camera') },
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

  // Catégorie actuelle
  const currentCat = categories.find(c => c.id === catId) ?? categories[0];

  // Cycle vers la catégorie suivante (picker simple)
  const cycleCat = () => {
    const idx = categories.findIndex(c => c.id === catId);
    const next = categories[(idx + 1) % categories.length];
    setCatId(next.id);
  };

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
      formulaPeriod: itemType === 'membership' ? formulaPeriod : undefined,
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                  : itemType === 'membership'
                    ? 'Modifier la formule'
                    : 'Modifier le produit'
                : itemType === 'service'
                  ? 'Nouvelle prestation'
                  : itemType === 'membership'
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
                placeholder="Ex : Pain Œuf Mayo"
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
                placeholder="Ex : Pain croustillant, 2 œufs"
                placeholderTextColor="#5a5c80"
                returnKeyType="next"
                onFocus={() => scrollToField(descY)}
              />
            </View>

            {/* Prix + Catégorie (2 colonnes) ──────────────────────────────── */}
            <View style={styles.row2} onLayout={e => setPriceY(e.nativeEvent.layout.y)}>
              <View style={styles.flex}>
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

              <View style={styles.flex}>
                <FieldLabel>Catégorie</FieldLabel>
                <TouchableOpacity style={styles.catPicker} onPress={cycleCat} activeOpacity={0.8}>
                  <Text style={styles.catPickerTxt} numberOfLines={1}>
                    {currentCat?.label ?? '—'}
                  </Text>
                  <Text style={styles.catChevron}>⌄</Text>
                </TouchableOpacity>
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

            {/* Période — uniquement pour les formules d'abonnement */}
            {itemType === 'membership' && (
              <View style={{ marginTop: 14 }}>
                <FieldLabel>Période de la formule</FieldLabel>
                <View style={styles.periodRow}>
                  {(Object.entries(FORMULA_PERIOD_LABELS) as [FormulaPeriod, string][]).map(
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
  catPicker: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catPickerTxt: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  catChevron: {
    color: colors.muted,
    fontSize: 16,
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
