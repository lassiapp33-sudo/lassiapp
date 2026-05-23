import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { StoreProduct, StoreCategory } from '../../types/store';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCamera = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" stroke={colors.accent} />
    <Circle cx={12} cy={13} r={3} stroke={colors.accent} />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

// Emojis disponibles pour illustrer un produit (palette rapide)
const QUICK_EMOJIS = ['🥖','🍳','🥪','🍝','☕','🍵','🥤','🍚','🥘','🍗','🍔','🥗','🍰','🧃'];

const BOTTOM_PAD = Platform.OS === 'ios' ? 28 : 14;

// ─── Label de champ ───────────────────────────────────────────────────────────

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={styles.label}>{children}</Text>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  visible:    boolean;
  product:    StoreProduct | null;   // null = nouveau produit
  categories: StoreCategory[];
  onSave:     (p: StoreProduct) => void;
  onClose:    () => void;
}

export default function AddProductSheet({ visible, product, categories, onSave, onClose }: Props) {
  const [emoji,  setEmoji]  = useState('🥖');
  const [name,   setName]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [price,  setPrice]  = useState('');
  const [catId,  setCatId]  = useState(categories[0]?.id ?? '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const scrollRef  = useRef<ScrollView>(null);
  const [nameY,  setNameY]  = useState(0);
  const [descY,  setDescY]  = useState(0);
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
      setName(product.name);
      setDesc(product.desc);
      setPrice(product.price.toString());
      setCatId(product.category);
    } else {
      setEmoji('🥖');
      setName('');
      setDesc('');
      setPrice('');
      setCatId(categories[0]?.id ?? '');
    }
    setShowEmojiPicker(false);
  }, [visible]);

  // Catégorie actuelle
  const currentCat = categories.find(c => c.id === catId) ?? categories[0];

  // Cycle vers la catégorie suivante (picker simple)
  const cycleCat = () => {
    const idx  = categories.findIndex(c => c.id === catId);
    const next = categories[(idx + 1) % categories.length];
    setCatId(next.id);
  };

  const handleSave = () => {
    if (!name.trim() || !price) return;
    const p: StoreProduct = {
      id:       product?.id ?? `p_${Date.now()}`,
      emoji,
      name:     name.trim(),
      desc:     desc.trim(),
      price:    parseInt(price, 10) || 0,
      category: catId,
      stock:    product?.stock ?? 'in',
    };
    onSave(p);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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

          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>
              {product ? 'Modifier le produit' : 'Nouveau produit'}
            </Text>

            {/* Zone photo / emoji ─────────────────────────────────────────── */}
            <TouchableOpacity
              style={styles.photoZone}
              onPress={() => setShowEmojiPicker(v => !v)}
              activeOpacity={0.85}
            >
              {showEmojiPicker ? (
                // Palette d'emojis rapide
                <View style={styles.emojiGrid}>
                  {QUICK_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiBtn, e === emoji && styles.emojiBtnSel]}
                      onPress={() => { setEmoji(e); setShowEmojiPicker(false); }}
                    >
                      <Text style={styles.emojiTxt}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : emoji !== '🥖' || product ? (
                // Emoji sélectionné
                <Text style={styles.bigEmoji}>{emoji}</Text>
              ) : (
                // Invite photo (état initial)
                <>
                  <View style={styles.camCircle}><IcoCamera /></View>
                  <Text style={styles.photoHint}>Ajoute une photo du produit</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Nom ────────────────────────────────────────────────────────── */}
            <View onLayout={(e) => setNameY(e.nativeEvent.layout.y)}>
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
            <View onLayout={(e) => setDescY(e.nativeEvent.layout.y)}>
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
            <View style={styles.row2} onLayout={(e) => setPriceY(e.nativeEvent.layout.y)}>
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

            <View style={{ height: 18 }} />

            {/* Bouton sauvegarder ─────────────────────────────────────────── */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <IcoCheck />
              <Text style={styles.saveTxt}>Enregistrer le produit</Text>
            </TouchableOpacity>

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
  },
  bigEmoji: {
    fontSize: 50,
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
});
