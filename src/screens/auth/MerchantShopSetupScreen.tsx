/**
 * screens/auth/MerchantShopSetupScreen.tsx
 * Parcours d'inscription marchand en 4 étapes :
 *   1. Catégorie        — quel type de commerce ?
 *   2. Sous-catégorie   — spécialité (single ou multiple selon config)
 *   3. Identité         — nom, logo, description
 *   4. Horaires         — planning hebdomadaire (optionnel, peut être sauté)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import BackButton from '../../components/auth/BackButton';
import AuthButton from '../../components/auth/AuthButton';
import LassiLogo from '../../components/LassiLogo';
import Avatar from '../../components/Avatar';
import OpeningHoursCard from '../../components/store/OpeningHoursCard';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import { RegisterData } from './RegisterScreen';
import { CatId, CATEGORIES, CatConfig, getCatConfig } from '../../config/categories';
import { DEFAULT_WEEK_HOURS, WeekHours } from '../../services/hours';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import * as storageService from '../../services/storage';
import * as authService from '../../services/auth';
import useAuthStore from '../../store/authStore';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userData: RegisterData;
  onBack: () => void;
  onComplete: (role: 'merchant') => void;
}

type Step = 1 | 2 | 3 | 4;

// ─── En-tête commun (défini hors du composant pour éviter le remontage) ───────

const STEP_LABELS = ['Catégorie', 'Spécialité', 'Identité', 'Horaires'];

interface HeaderProps {
  step: Step;
  onBack: () => void;
}

const Header = React.memo(function Header({ step, onBack }: HeaderProps) {
  return (
    <>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <LassiLogo width={72} />
      </View>
      <View style={styles.progressRow}>
        {([1, 2, 3, 4] as Step[]).map(s => (
          <View
            key={s}
            style={[
              styles.progressSeg,
              s <= step ? styles.progressSegDone : styles.progressSegEmpty,
            ]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        Étape {step} sur 4 — {STEP_LABELS[step - 1]}
      </Text>
    </>
  );
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MerchantShopSetupScreen({ userData, onBack, onComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [catId, setCatId] = useState<CatId | null>(null);
  const [subcats, setSubcats] = useState<string[]>([]);
  const [shopName, setShopName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [hours, setHours] = useState<WeekHours>(DEFAULT_WEEK_HOURS);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const catConfig: CatConfig | undefined = catId ? getCatConfig(catId) : undefined;

  // ── Navigation entre étapes ───────────────────────────────────────────────

  const handleBack = () => {
    setErreur(null);
    if (step === 1) onBack();
    else setStep((step - 1) as Step);
  };

  const handleNext = () => {
    setErreur(null);
    if (step === 1) {
      if (!catId) {
        setErreur('Choisis une catégorie pour ton commerce.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (subcats.length === 0) {
        setErreur('Choisis au moins une spécialité.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!shopName.trim()) {
        setErreur('Le nom du commerce est obligatoire.');
        return;
      }
      setStep(4);
    } else {
      handleSubmit(false);
    }
  };

  // Ouvre la galerie pour le logo
  const handlePickLogo = async () => {
    const uri = await storageService.pickImageFromGallery();
    if (uri) setLogoUri(uri);
  };

  // Toggle sous-catégorie (single = radio, multiple = checkboxes)
  const toggleSubcat = (id: string) => {
    if (!catConfig) return;
    if (catConfig.subcatMode === 'single') {
      setSubcats([id]);
    } else {
      setSubcats(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
    }
  };

  const selectCat = (id: CatId) => {
    setCatId(id);
    setSubcats([]);
  };

  // ── Soumission finale ─────────────────────────────────────────────────────

  const handleSubmit = async (skipHours: boolean) => {
    setLoading(true);
    try {
      // Tagline auto-générée depuis les sous-catégories choisies
      const autoSubtitle = catConfig
        ? subcats.map(id => catConfig.subcats.find(s => s.id === id)?.label ?? id).join(' · ')
        : '';

      // Position GPS à la finalisation du compte → "domicile fixe" du commerce
      // (modifiable ensuite uniquement via le bouton "Définir l'emplacement de ma boutique")
      let latitude: number | null = null;
      let longitude: number | null = null;
      let zone = '';
      const coords = await getCurrentLocation();
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
        zone = await reverseGeocode(coords.latitude, coords.longitude);
      }

      const user = await authService.registerMerchant({
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        password: userData.password,
        shopName: shopName.trim(),
        shopSubtitle: autoSubtitle || undefined,
        shopCategory: catId!,
        shopSubcategories: subcats,
        shopType: catConfig?.shopType ?? 'products',
        openingHours: skipHours ? null : hours,
        logoLocalUri: logoUri,
        latitude,
        longitude,
        zone,
      });
      useAuthStore.getState().setUser(user);
      onComplete('merchant');
    } catch (e: unknown) {
      setErreur(getErrorMessage(e));
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 1 : Catégorie ───────────────────────────────────────────────────

  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Header step={step} onBack={handleBack} />
          <Text style={styles.h1}>Quel type de commerce ?</Text>
          <Text style={styles.sub}>
            Choisis la catégorie qui correspond le mieux à ton activité.
          </Text>
          <View style={{ height: 20 }} />

          {CATEGORIES.map(cat => {
            const on = cat.id === catId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catRow, on && styles.catRowOn]}
                onPress={() => selectCat(cat.id)}
                activeOpacity={0.8}
              >
                <View style={styles.catIconBox}>
                  {cat.renderIcon(on ? colors.accent : colors.muted, 26)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catLabel, on && styles.catLabelOn]}>{cat.label}</Text>
                  <Text style={styles.catSub}>{cat.subcats.map(s => s.label).join(', ')}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <View style={{ height: 16 }} />
          <AuthButton label="Suivant →" onPress={handleNext} loading={false} />
          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Étape 2 : Sous-catégorie ──────────────────────────────────────────────

  if (step === 2 && catConfig) {
    const isMultiple = catConfig.subcatMode === 'multiple';
    return (
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Header step={step} onBack={handleBack} />
          <Text style={styles.h1}>
            {isMultiple ? 'Tes spécialités' : 'Ton activité principale'}
          </Text>
          <Text style={styles.sub}>
            {isMultiple
              ? 'Coche tout ce que tu proposes. Ça aide les clients à te trouver.'
              : 'Choisis le type qui décrit le mieux ton commerce.'}
          </Text>
          <View style={{ height: 20 }} />

          {catConfig.subcats.map(sub => {
            const on = subcats.includes(sub.id);
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subcatRow, on && styles.subcatRowOn]}
                onPress={() => toggleSubcat(sub.id)}
                activeOpacity={0.8}
              >
                {sub.imageUri ? (
                  <Image source={sub.imageUri} style={styles.subcatImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.subcatEmoji}>{sub.emoji}</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subcatLabel, on && styles.subcatLabelOn]}>{sub.label}</Text>
                  <Text style={styles.subcatDesc}>{sub.desc}</Text>
                </View>
                {/* Checkbox ou radio selon le mode */}
                <View
                  style={[
                    isMultiple ? styles.checkbox : styles.radio,
                    on && (isMultiple ? styles.checkboxOn : styles.radioOn),
                  ]}
                >
                  {on &&
                    (isMultiple ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : (
                      <View style={styles.radioDot} />
                    ))}
                </View>
              </TouchableOpacity>
            );
          })}

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <View style={{ height: 16 }} />
          <AuthButton label="Suivant →" onPress={handleNext} loading={false} />
          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Étape 3 : Identité ────────────────────────────────────────────────────

  if (step === 3) {
    return (
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Header step={step} onBack={handleBack} />
          <Text style={styles.h1}>Présente ton commerce</Text>
          <Text style={styles.sub}>
            Le nom et le logo apparaîtront sur ta fiche boutique. Tu pourras ajouter une description
            depuis ta vitrine.
          </Text>
          <View style={{ height: 24 }} />

          {/* Logo */}
          <Text style={styles.sectionLbl}>
            Logo <Text style={styles.opt}>(optionnel)</Text>
          </Text>
          <TouchableOpacity style={styles.logoRow} onPress={handlePickLogo} activeOpacity={0.8}>
            <View style={styles.logoAvatarWrap}>
              <Avatar
                imageUrl={logoUri}
                name={shopName || userData.name}
                size={68}
                variant="shop"
                showBorder
              />
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeTxt}>+</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoHintTitle}>
                {logoUri ? 'Appuie pour changer' : 'Ajouter un logo'}
              </Text>
              <Text style={styles.logoHintSub}>Visible par tous tes clients sur ta fiche.</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 20 }} />

          {/* Nom */}
          <Text style={styles.sectionLbl}>
            Nom du commerce <Text style={styles.req}>*</Text>
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Ex : Tangana Aminata, Boutique Ndoye…"
              placeholderTextColor="#5a5c80"
              value={shopName}
              onChangeText={setShopName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={{ height: 18 }} />
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <AuthButton label="Suivant →" onPress={handleNext} loading={false} />
          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Étape 4 : Horaires ────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header step={step} onBack={handleBack} />
        <Text style={styles.h1}>Tes horaires d'ouverture</Text>
        <Text style={styles.sub}>
          Définir tes horaires permet aux clients de savoir si tu es ouvert en temps réel. Tu
          pourras les modifier à tout moment depuis ta vitrine.
        </Text>
        <View style={{ height: 20 }} />

        <OpeningHoursCard
          hours={hours}
          isManuallyClose={false}
          readOnly={false}
          onChange={setHours}
        />

        {erreur ? <Text style={[styles.erreur, { marginTop: 12 }]}>{erreur}</Text> : null}
        <View style={{ height: 20 }} />

        <AuthButton
          label="Terminer et ouvrir ma boutique"
          onPress={() => handleSubmit(false)}
          loading={loading}
        />

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => handleSubmit(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.skipTxt}>Passer cette étape</Text>
        </TouchableOpacity>

        <View style={{ height: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
    flexGrow: 1,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  // Barre de progression
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 99,
  },
  progressSegDone: { backgroundColor: colors.accent },
  progressSegEmpty: { backgroundColor: colors.border },
  stepLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginBottom: 16,
  },

  h1: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
    marginTop: 8,
  },

  // Étape 1 — rangée catégorie
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  catRowOn: {
    backgroundColor: 'rgba(253,207,52,.08)',
    borderColor: colors.accent,
  },
  catIconBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  catLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 2,
  },
  catLabelOn: { color: colors.white },
  catSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },

  // Étape 2 — rangée sous-catégorie
  subcatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  subcatRowOn: {
    backgroundColor: 'rgba(253,207,52,.08)',
    borderColor: colors.accent,
  },
  subcatEmoji: { fontSize: 22, width: 38, textAlign: 'center' },
  subcatImg: { width: 38, height: 38, borderRadius: 6 },
  subcatLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 2,
  },
  subcatLabelOn: { color: colors.white },
  subcatDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkmark: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 12,
    lineHeight: 16,
  },

  // Étape 3 — logo
  sectionLbl: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.3,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  req: { color: colors.accent },
  opt: { color: colors.muted, textTransform: 'none', fontSize: 11 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  logoAvatarWrap: { position: 'relative', flexShrink: 0 },
  logoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  logoBadgeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
    lineHeight: 18,
  },
  logoHintTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
    marginBottom: 4,
  },
  logoHintSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  // Erreur
  erreur: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },

  // Étape 4 — bouton passer
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
