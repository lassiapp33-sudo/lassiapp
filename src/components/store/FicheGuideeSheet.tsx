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
import { getAllSuggestions, SuggestionFiche, FicheSection } from '../../services/ficheGuidee';
import useShopStore from '../../store/shopStore';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

const IcoChevronRight = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" stroke={colors.accent} />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionState {
  selected: string;   // valeur choisie (chip ou saisie libre)
  isCustom: boolean;  // true = saisie libre active
  custom: string;     // texte tapé en mode libre
}

const EMPTY_SECTION: SectionState = { selected: '', isCustom: false, custom: '' };

const SECTIONS: { key: FicheSection; label: string }[] = [
  { key: 'type_contenu',           label: 'Type de contenu' },
  { key: 'sous_categorie_produit', label: 'Sous-catégorie' },
  { key: 'nom_produit',            label: 'Nom du produit' },
  { key: 'prix',                   label: 'Prix (FCFA)' },
];

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
  const shopCategory = useShopStore(s => s.context.category);
  const shopType     = useShopStore(s => s.context.shopType);

  // Suggestions chargées depuis la DB, groupées par section
  const [suggs, setSuggs] = useState<Record<FicheSection, SuggestionFiche[]>>({
    type_contenu:           [],
    sous_categorie_produit: [],
    nom_produit:            [],
    prix:                   [],
  });
  const [loadingSuggs, setLoadingSuggs] = useState(false);

  // États des 4 sections
  const [sec1, setSec1] = useState<SectionState>(EMPTY_SECTION);
  const [sec2, setSec2] = useState<SectionState>(EMPTY_SECTION);
  const [sec3, setSec3] = useState<SectionState>(EMPTY_SECTION);
  const [sec4, setSec4] = useState<SectionState>(EMPTY_SECTION);
  // Description libre (section 5)
  const [desc, setDesc] = useState('');

  // Catégorie cible dans le catalogue
  const [catId, setCatId] = useState(defaultCatId ?? categories[0]?.id ?? '');

  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Nombre de sections visibles (cascade progressive)
  const visibleSections = (() => {
    if (!getValue(sec1)) return 1;
    if (!getValue(sec2)) return 2;
    if (!getValue(sec3)) return 3;
    if (!getValue(sec4)) return 4;
    return 5;
  })();

  const canSubmit = !!getValue(sec3) && !!getValue(sec4);

  // Charge les suggestions à l'ouverture
  useEffect(() => {
    if (!visible) return;
    // Reset
    setSec1(EMPTY_SECTION);
    setSec2(EMPTY_SECTION);
    setSec3(EMPTY_SECTION);
    setSec4(EMPTY_SECTION);
    setDesc('');
    setCatId(defaultCatId ?? categories[0]?.id ?? '');

    if (!shopCategory) return;
    setLoadingSuggs(true);
    getAllSuggestions(shopCategory)
      .then(list => {
        const grouped: Record<FicheSection, SuggestionFiche[]> = {
          type_contenu:           [],
          sous_categorie_produit: [],
          nom_produit:            [],
          prix:                   [],
        };
        for (const s of list) grouped[s.section].push(s);
        setSuggs(grouped);
      })
      .catch(() => {})
      .finally(() => setLoadingSuggs(false));
  }, [visible, shopCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll vers le bas quand une nouvelle section devient visible
  useEffect(() => {
    if (visibleSections > 1) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visibleSections]);

  function getValue(s: SectionState): string {
    return s.isCustom ? s.custom.trim() : s.selected;
  }

  function setSectionValue(
    setter: React.Dispatch<React.SetStateAction<SectionState>>,
    value: string,
    isCustom = false,
  ) {
    setter({ selected: isCustom ? '' : value, isCustom, custom: isCustom ? '' : '' });
    // Reset les sections suivantes en cascade
  }

  // Quand on change sec1 → reset sec2, sec3, sec4
  function pickSec1(val: string, isCustom = false) {
    setter1(val, isCustom);
    setSec2(EMPTY_SECTION);
    setSec3(EMPTY_SECTION);
    setSec4(EMPTY_SECTION);
    setDesc('');
  }
  function setter1(val: string, isCustom = false) {
    setSec1({ selected: isCustom ? '' : val, isCustom, custom: isCustom ? '' : '' });
  }

  function pickSec2(val: string, isCustom = false) {
    setSec2({ selected: isCustom ? '' : val, isCustom, custom: isCustom ? '' : '' });
    setSec3(EMPTY_SECTION);
    setSec4(EMPTY_SECTION);
    setDesc('');
  }

  function pickSec3(val: string, isCustom = false) {
    setSec3({ selected: isCustom ? '' : val, isCustom, custom: isCustom ? '' : '' });
    setSec4(EMPTY_SECTION);
    setDesc('');
  }

  function pickSec4(val: string, isCustom = false) {
    setSec4({ selected: isCustom ? '' : val, isCustom, custom: isCustom ? '' : '' });
    setDesc('');
  }

  const handleSave = async () => {
    const name  = getValue(sec3);
    const price = parseInt(getValue(sec4).replace(/\D/g, ''), 10);

    if (!name) { Alert.alert('Champ requis', 'Choisis ou saisis le nom du produit.'); return; }
    if (!price) { Alert.alert('Champ requis', 'Choisis ou saisis le prix du produit.'); return; }

    const itemType =
      shopType === 'services'    ? ('service'    as const) :
      shopType === 'memberships' ? ('membership' as const) :
                                   ('product'    as const);

    const product: StoreProduct = {
      id:       `p_${Date.now()}`,
      emoji:    '',
      name,
      desc:     desc.trim(),
      price,
      category: catId,
      stock:    'in',
      itemType,
    };

    setSaving(true);
    try {
      await onSave(product);
      onClose();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le produit. Vérifie ta connexion et réessaie.");
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
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
          {/* Poignée */}
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
                  i < visibleSections && styles.progressDotDone,
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
            {/* ── Section 1 : Type de contenu ─────────────────────────────── */}
            <CascadeSection
              label="Type de contenu"
              chips={suggs.type_contenu.map(s => s.valeur)}
              state={sec1}
              onChip={v => pickSec1(v)}
              onCustom={() => pickSec1('', true)}
              onCustomChange={v => setSec1(p => ({ ...p, custom: v }))}
              isDone={!!getValue(sec1)}
              placeholder="Ex : Menu, Catalogue, Tarifs…"
            />

            {/* ── Section 2 : Sous-catégorie ──────────────────────────────── */}
            {visibleSections >= 2 && (
              <CascadeSection
                label="Sous-catégorie de produit"
                chips={suggs.sous_categorie_produit.map(s => s.valeur)}
                state={sec2}
                onChip={v => pickSec2(v)}
                onCustom={() => pickSec2('', true)}
                onCustomChange={v => setSec2(p => ({ ...p, custom: v }))}
                isDone={!!getValue(sec2)}
                placeholder="Ex : Repas, Boisson, Dessert…"
              />
            )}

            {/* ── Section 3 : Nom du produit ──────────────────────────────── */}
            {visibleSections >= 3 && (
              <CascadeSection
                label="Nom du produit"
                chips={suggs.nom_produit.map(s => s.valeur)}
                state={sec3}
                onChip={v => pickSec3(v)}
                onCustom={() => pickSec3('', true)}
                onCustomChange={v => setSec3(p => ({ ...p, custom: v }))}
                isDone={!!getValue(sec3)}
                placeholder="Ex : Burger, Tresses, Baguette…"
              />
            )}

            {/* ── Section 4 : Prix ────────────────────────────────────────── */}
            {visibleSections >= 4 && (
              <CascadeSection
                label="Prix (FCFA)"
                chips={suggs.prix.map(s => s.valeur)}
                state={sec4}
                onChip={v => pickSec4(v)}
                onCustom={() => pickSec4('', true)}
                onCustomChange={v => {
                  const digits = v.replace(/\D/g, '');
                  setSec4(p => ({ ...p, custom: digits }));
                }}
                isDone={!!getValue(sec4)}
                placeholder="Saisir le prix exact…"
                keyboardType="numeric"
                chipSuffix=" F"
              />
            )}

            {/* ── Section 5 : Description (100% libre) ────────────────────── */}
            {visibleSections >= 5 && (
              <View style={styles.section}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <Text style={styles.sectionOptional}>(optionnel)</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="Décris le produit librement : taille, ingrédients, durée…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* ── Catégorie cible (catalogue) ─────────────────────────────── */}
            {visibleSections >= 5 && categories.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Ajouter dans</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
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
                </ScrollView>
              </View>
            )}

            {/* ── Bouton Enregistrer ──────────────────────────────────────── */}
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

// ─── Sous-composant : section cascade ────────────────────────────────────────

interface CascadeSectionProps {
  label: string;
  chips: string[];
  state: SectionState;
  onChip: (v: string) => void;
  onCustom: () => void;
  onCustomChange: (v: string) => void;
  isDone: boolean;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
  chipSuffix?: string;
}

function CascadeSection({
  label, chips, state, onChip, onCustom, onCustomChange,
  isDone, placeholder, keyboardType = 'default', chipSuffix = '',
}: CascadeSectionProps) {
  const value = state.isCustom ? state.custom.trim() : state.selected;
  const done  = !!value;

  return (
    <View style={[styles.section, done && !state.isCustom && styles.sectionDone]}>
      <View style={styles.sectionLabelRow}>
        <Text style={[styles.sectionLabel, done && styles.sectionLabelDone]}>{label}</Text>
        {done && !state.isCustom && (
          <View style={styles.doneBadge}>
            <Text style={styles.doneBadgeTxt}>{state.selected}{chipSuffix}</Text>
          </View>
        )}
      </View>

      {/* Chips */}
      <View style={styles.chipRow}>
        {chips.map(chip => {
          const active = !state.isCustom && state.selected === chip;
          return (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChip(chip)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {chip}{chipSuffix}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Chip "Autre" */}
        <TouchableOpacity
          style={[styles.chip, styles.chipAutre, state.isCustom && styles.chipActive]}
          onPress={onCustom}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipTxt, state.isCustom && styles.chipTxtActive]}>Autre…</Text>
          <IcoChevronRight />
        </TouchableOpacity>
      </View>

      {/* Saisie libre (mode Autre) */}
      {state.isCustom && (
        <TextInput
          style={styles.input}
          value={state.custom}
          onChangeText={onCustomChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoFocus
          returnKeyType="done"
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Barre de progression
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: 'rgba(253,207,52,.4)',
  },
  progressDotDone: {
    backgroundColor: colors.accent,
  },

  scrollContent: { paddingBottom: 8 },

  // Section cascade
  section: {
    marginBottom: 18,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionDone: {
    borderColor: 'rgba(253,207,52,.25)',
    backgroundColor: 'rgba(253,207,52,.04)',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionLabelDone: {
    color: colors.accent,
  },
  sectionOptional: {
    color: '#3a3c5a',
    fontFamily: fonts.body,
    fontSize: 11,
  },
  doneBadge: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  doneBadgeTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 12,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipAutre: {
    borderStyle: 'dashed',
  },
  chipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  chipTxtActive: {
    color: colors.bg,
    fontFamily: fonts.title,
  },

  // Input
  input: {
    marginTop: 10,
    height: 48,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // Catégorie cible
  catRow: {
    marginTop: 8,
    flexGrow: 0,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: 'rgba(253,207,52,.12)',
    borderColor: colors.accent,
  },
  catChipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  catChipTxtActive: {
    color: colors.accent,
    fontFamily: fonts.title,
  },

  // Bouton enregistrer
  saveBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
});
