import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { StoreProduct, StoreCategory } from '../../types/store';
import { getToutesSuggestions, Suggestion } from '../../services/ficheGuidee';
import useShopStore from '../../store/shopStore';
import SelecteurPuces from './SelecteurPuces';

// ─── Icône ────────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuggsState {
  typeContenu:   Suggestion[];
  sousCategorie: Suggestion[];
  nomProduit:    Suggestion[];
  prix:          Suggestion[];
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 28 : 14;

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  categories: StoreCategory[];
  defaultCatId?: string;
  onSave: (p: StoreProduct) => Promise<void>;
  onClose: () => void;
}

export default function FicheGuideeSheet({
  visible,
  categories,
  defaultCatId,
  onSave,
  onClose,
}: Props) {
  const subcategories = useShopStore(s => s.context.subcategories);
  const shopType      = useShopStore(s => s.context.shopType);
  const sousCatId     = subcategories[0] ?? '';

  const [suggs, setSuggs] = useState<SuggsState>({
    typeContenu: [], sousCategorie: [], nomProduit: [], prix: [],
  });
  const [loadingSuggs, setLoadingSuggs] = useState(false);

  // État de chaque section : simple string (valeur choisie ou tapée)
  const [sec1, setSec1] = useState('');
  const [sec2, setSec2] = useState('');
  const [sec3, setSec3] = useState('');
  const [sec4, setSec4] = useState('');
  const [desc, setDesc]  = useState('');
  const [catId, setCatId] = useState(defaultCatId ?? categories[0]?.id ?? '');

  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Sections visibles en cascade
  const visibleSections = !sec1 ? 1 : !sec2 ? 2 : !sec3 ? 3 : !sec4 ? 4 : 5;
  const canSubmit = !!sec3.trim() && !!sec4.trim();

  // Chargement des suggestions + reset à l'ouverture
  useEffect(() => {
    if (!visible) return;
    setSec1(''); setSec2(''); setSec3(''); setSec4(''); setDesc('');
    setCatId(defaultCatId ?? categories[0]?.id ?? '');
    if (!sousCatId) return;
    setLoadingSuggs(true);
    getToutesSuggestions(sousCatId)
      .then(setSuggs)
      .catch(() => {})
      .finally(() => setLoadingSuggs(false));
  }, [visible, sousCatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll vers le bas quand une nouvelle section apparaît
  useEffect(() => {
    if (visibleSections > 1) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [visibleSections]);

  const handleSave = async () => {
    const name  = sec3.trim();
    const price = parseInt(sec4.replace(/\D/g, ''), 10);
    if (!name)  { Alert.alert('Champ requis', 'Choisis ou saisis le nom du produit.'); return; }
    if (!price) { Alert.alert('Champ requis', 'Choisis ou saisis le prix du produit.'); return; }

    const itemType =
      shopType === 'services'    ? ('service'    as const) :
      shopType === 'memberships' ? ('membership' as const) :
                                   ('product'    as const);

    const product: StoreProduct = {
      id: `p_${Date.now()}`,
      emoji: '',
      name,
      desc: desc.trim(),
      price,
      category: catId,
      stock: 'in',
      itemType,
    };
    setSaving(true);
    try {
      await onSave(product);
      onClose();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le produit. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent presentationStyle="overFullScreen" animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
          <View style={styles.grab} />

          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Fiche Guidée</Text>
              <Text style={styles.subtitle}>Réponds section par section</Text>
            </View>
            {loadingSuggs && <ActivityIndicator color={colors.accent} size="small" />}
          </View>

          {/* Barre de progression */}
          <View style={styles.progressBar}>
            {[1,2,3,4,5].map(i => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= visibleSections && styles.progressDotActive,
                  i < visibleSections  && styles.progressDotDone,
                ]}
              />
            ))}
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Section 1 */}
            <SelecteurPuces
              key="sec1"
              label="Type de contenu"
              suggestions={suggs.typeContenu}
              valeurSelectionnee={sec1}
              onSelectionner={v => { setSec1(v); setSec2(''); setSec3(''); setSec4(''); setDesc(''); }}
              placeholderLibre="Ex : Menu, Catalogue, Tarifs…"
            />

            {/* Section 2 */}
            {visibleSections >= 2 && (
              <SelecteurPuces
                key={`sec2-${sec1}`}
                label="Sous-catégorie de produit"
                suggestions={suggs.sousCategorie}
                valeurSelectionnee={sec2}
                onSelectionner={v => { setSec2(v); setSec3(''); setSec4(''); setDesc(''); }}
                placeholderLibre="Ex : Repas, Boisson, Dessert…"
              />
            )}

            {/* Section 3 */}
            {visibleSections >= 3 && (
              <SelecteurPuces
                key={`sec3-${sec2}`}
                label="Nom du produit"
                suggestions={suggs.nomProduit}
                valeurSelectionnee={sec3}
                onSelectionner={v => { setSec3(v); setSec4(''); setDesc(''); }}
                placeholderLibre="Ex : Burger, Tresses, Baguette…"
              />
            )}

            {/* Section 4 */}
            {visibleSections >= 4 && (
              <SelecteurPuces
                key={`sec4-${sec3}`}
                label="Prix (FCFA)"
                suggestions={suggs.prix}
                valeurSelectionnee={sec4}
                onSelectionner={setSec4}
                placeholderLibre="Saisir le prix exact…"
              />
            )}

            {/* Section 5 : description 100% libre */}
            {visibleSections >= 5 && (
              <View style={styles.descSection}>
                <Text style={styles.descLabel}>
                  Description <Text style={styles.descOptional}>(optionnel)</Text>
                </Text>
                <TextInput
                  style={styles.descInput}
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="Décris le produit librement : taille, ingrédients, durée…"
                  placeholderTextColor="#6B6F9E"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Catégorie cible */}
            {visibleSections >= 5 && categories.length > 1 && (
              <View style={styles.catSection}>
                <Text style={styles.descLabel}>Ajouter dans</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.catRow}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catChip, catId === cat.id && styles.catChipActive]}
                        onPress={() => setCatId(cat.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.catChipTxt, catId === cat.id && styles.catChipTxtActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Bouton enregistrer */}
            {canSubmit && (
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.55 }]}
                onPress={saving ? undefined : handleSave}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <><IcoCheck /><Text style={styles.saveTxt}>Ajouter ce produit</Text></>
                }
              </TouchableOpacity>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,11,24,.65)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: 'rgba(253,207,52,.4)' },
  progressDotDone:   { backgroundColor: colors.accent },
  scrollContent: { paddingBottom: 8 },

  // Description
  descSection: { marginBottom: 20 },
  descLabel: {
    color: '#EDEEF7',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 14,
    marginBottom: 10,
  },
  descOptional: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  descInput: {
    backgroundColor: '#1E2040',
    borderRadius: 12,
    padding: 12,
    color: '#EDEEF7',
    borderWidth: 1,
    borderColor: '#2A2C52',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Catégorie cible
  catSection: { marginBottom: 20 },
  catRow: { flexDirection: 'row', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1E2040',
  },
  catChipActive: {
    backgroundColor: 'rgba(253,207,52,.12)',
    borderColor: colors.accent,
  },
  catChipTxt: { color: '#9A9EC4', fontSize: 13 },
  catChipTxtActive: {
    color: colors.accent,
    fontFamily: fonts.title,
  },

  // Bouton
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

