import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { contacterServiceClient, SUPPORT_EMAIL } from '../../config/contact';
import {
  envoyerSignalement,
  uploadScreenshot,
  TYPE_LABELS,
  TYPE_LABELS_PRO,
  type SignalementType,
} from '../../services/signalements';
import * as storage from '../../services/storage';
import useAuthStore from '../../store/authStore';
import MascoHomeBtn from '../../components/MascoHomeBtn';
import { getErrorMessage } from '../../utils/errorUtils';
import { IcoBack } from '../../components/icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCamera = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      stroke={colors.accent}
    />
    <Circle cx={12} cy={13} r={4} stroke={colors.accent} />
  </Svg>
);

const IcoTrash = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke={colors.danger} />
  </Svg>
);

const IcoCheck = () => (
  <Svg
    width={40}
    height={40}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={12} r={10} stroke={colors.success} />
    <Path d="M9 12l2 2 4-4" stroke={colors.success} />
  </Svg>
);

const IcoPhone = () => (
  <Svg
    width={15}
    height={15}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.05 2.78h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18l-.08-1.08Z"
      stroke={colors.accent}
    />
  </Svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────

const TYPES: SignalementType[] = ['bug', 'paiement', 'commande', 'commerce', 'arnaque', 'autre'];

interface Props {
  onBack: () => void;
  profil: 'client' | 'prestataire';
  orderId?: string;
  shopId?: string;
  contextLabel?: string;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function SignalerProblemeScreen({
  onBack,
  profil,
  orderId,
  shopId,
  contextLabel,
}: Props) {
  const user = useAuthStore(s => s.user);
  const labels = profil === 'prestataire' ? TYPE_LABELS_PRO : TYPE_LABELS;

  const [type, setType] = useState<SignalementType | null>(null);
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Capture d'écran ────────────────────────────────────────────────────────

  async function handlePickScreenshot() {
    const pick = async (source: 'gallery' | 'camera') => {
      const uri =
        source === 'gallery'
          ? await storage.pickImageFromGallery()
          : await storage.pickImageFromCamera();
      if (uri) setScreenshotUri(uri);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie', 'Appareil photo'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) pick('gallery');
          if (idx === 2) pick('camera');
        },
      );
    } else {
      Alert.alert('Ajouter une capture', '', [
        { text: 'Galerie', onPress: () => pick('gallery') },
        { text: 'Appareil photo', onPress: () => pick('camera') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  }

  // ── Envoi ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    if (!type) return setError('Choisis un type de problème.');
    if (description.trim().length < 10)
      return setError('La description doit faire au moins 10 caractères.');

    setSubmitting(true);
    try {
      let screenshotUrl: string | undefined;
      if (screenshotUri && user?.id) {
        setUploading(true);
        screenshotUrl = await uploadScreenshot(screenshotUri, user.id);
        setUploading(false);
      }

      await envoyerSignalement({
        profil,
        type,
        description,
        orderId,
        shopId,
        screenshotUrl,
      });

      setDone(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  // ── Écran de confirmation ──────────────────────────────────────────────────

  if (done) {
    return (
      <LassiScreen
        header={
          <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
            <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
              <IcoBack />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Signaler un problème</Text>
            <MascoHomeBtn />
          </View>
        }
      >
        <View style={s.confirmWrap}>
          <IcoCheck />
          <Text style={s.confirmTitle}>Signalement envoyé !</Text>
          <Text style={s.confirmTxt}>
            Ton signalement a été transmis à{'\n'}
            <Text style={s.confirmEmail}>{SUPPORT_EMAIL}</Text>
            {'\n\n'}Notre équipe va l'examiner dans les plus brefs délais.
          </Text>
          <TouchableOpacity style={s.backBtnLarge} onPress={onBack} activeOpacity={0.85}>
            <Text style={s.backBtnLargeTxt}>Retour au profil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.waBtn}
            onPress={() =>
              contacterServiceClient(
                "Bonjour LASSI, j'ai envoyé un signalement et j'ai besoin d'aide.",
              )
            }
            activeOpacity={0.75}
          >
            <IcoPhone />
            <Text style={s.waBtnTxt}>Réponse urgente ? WhatsApp +221 76 189 00 03</Text>
          </TouchableOpacity>
        </View>
      </LassiScreen>
    );
  }

  // ── Formulaire ─────────────────────────────────────────────────────────────

  return (
    <LassiScreen
      header={
        <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Signaler un problème</Text>
          <MascoHomeBtn />
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* ── Type de problème ──────────────────────────────────────── */}
          <Text style={s.label}>Type de problème *</Text>
          <View style={s.chipsWrap}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, type === t && s.chipOn]}
                onPress={() => setType(t)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipTxt, type === t && s.chipTxtOn]}>{labels[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Élément concerné (pré-rempli) ─────────────────────────── */}
          {contextLabel && (
            <>
              <Text style={s.label}>Élément concerné</Text>
              <View style={s.contextBadge}>
                <Text style={s.contextTxt}>{contextLabel}</Text>
              </View>
            </>
          )}

          {/* ── Description ───────────────────────────────────────────── */}
          <Text style={s.label}>
            Description * <Text style={s.labelSub}>(min. 10 caractères)</Text>
          </Text>
          <TextInput
            style={s.textarea}
            value={description}
            onChangeText={setDescription}
            placeholder="Décris ton problème en détail…"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={5}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{description.length} / 1000</Text>

          {/* ── Capture d'écran (optionnel) ────────────────────────────── */}
          <Text style={s.label}>
            Capture d'écran <Text style={s.labelSub}>(optionnel)</Text>
          </Text>
          {screenshotUri ? (
            <View style={s.screenshotWrap}>
              <Image source={{ uri: screenshotUri }} style={s.screenshotThumb} />
              <TouchableOpacity
                style={s.screenshotRemove}
                onPress={() => setScreenshotUri(null)}
                activeOpacity={0.75}
              >
                <IcoTrash />
                <Text style={s.screenshotRemoveTxt}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.photoBtn} onPress={handlePickScreenshot} activeOpacity={0.8}>
              <IcoCamera />
              <Text style={s.photoBtnTxt}>Ajouter une photo</Text>
            </TouchableOpacity>
          )}

          {/* ── Erreur ────────────────────────────────────────────────── */}
          {error && <Text style={s.errorTxt}>{error}</Text>}

          {/* ── Bouton envoyer ────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, (submitting || uploading) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting || uploading}
          >
            {submitting || uploading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={s.submitBtnTxt}>
                {uploading ? 'Envoi de la capture…' : 'Envoyer le signalement'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Lien service client ────────────────────────────────────── */}
          <TouchableOpacity
            style={s.callLink}
            onPress={() => contacterServiceClient("Bonjour Lassi, j'ai besoin d'aide.")}
            activeOpacity={0.75}
          >
            <IcoPhone />
            <Text style={s.callLinkTxt}>
              Besoin d'une réponse rapide ? Contacter le service client
            </Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LassiScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  // Labels
  label: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 10,
    marginTop: 20,
  },
  labelSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // Chips type
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },
  chipTxtOn: {
    color: colors.bg,
  },

  // Contexte pré-rempli
  contextBadge: {
    backgroundColor: 'rgba(253,207,52,.1)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  contextTxt: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  // Textarea
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
    minHeight: 120,
    lineHeight: 21,
  },
  charCount: {
    alignSelf: 'flex-end',
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 4,
  },

  // Photo
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 16,
    justifyContent: 'center',
  },
  photoBtnTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13.5,
  },
  screenshotWrap: {
    gap: 10,
  },
  screenshotThumb: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  screenshotRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  screenshotRemoveTxt: {
    color: '#E07A7A',
    fontFamily: fonts.ui,
    fontSize: 12,
  },

  // Erreur
  errorTxt: {
    marginTop: 12,
    color: '#E07A7A',
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },

  // Bouton submit
  submitBtn: {
    marginTop: 24,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Lien appel
  callLink: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callLinkTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
    flex: 1,
  },

  // Confirmation
  confirmWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  confirmTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    textAlign: 'center',
  },
  confirmTxt: {
    color: '#8a8eb5',
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  confirmEmail: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  backBtnLarge: {
    marginTop: 8,
    height: 52,
    paddingHorizontal: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnLargeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
  },
  waBtnTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
    flex: 1,
  },
});
