import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import useShopStore from '../../store/shopStore';
import {
  getMesBlocs,
  creerBloc,
  reactiverBloc,
  getQuotaDuJour,
  uploadBlocImage,
} from '../../services/aLaUne';
import StoryShareModal from '../../components/alaune/StoryShareModal';
import { computeStatus } from '../../services/hours';
import type { WeekHours } from '../../services/hours';
import type { BlocALaUne, ElementALaUne } from '../../types/aLaUne';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoFlame = ({ stroke }: { stroke: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke={stroke} />
  </Svg>
);

const IcoPlus = ({ stroke }: { stroke: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={stroke} />
  </Svg>
);

const IcoCamera = ({ stroke }: { stroke: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={stroke} />
    <Circle cx={12} cy={13} r={4} stroke={stroke} />
  </Svg>
);

const IcoGallery = ({ stroke }: { stroke: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={stroke} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={stroke} />
  </Svg>
);

const IcoTrash = ({ stroke }: { stroke: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={stroke} />
  </Svg>
);

const IcoClock = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} />
  </Svg>
);

const IcoShareUp = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke={colors.white} />
  </Svg>
);

const IcoSparkle = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" stroke={colors.accent} />
  </Svg>
);

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function formatCountdown(expireAt: string): string {
  const ms = new Date(expireAt).getTime() - Date.now();
  if (ms <= 0) return 'Expiré';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

// ─── Ligne élément ────────────────────────────────────────────────────────────

interface ElementShareRowProps {
  el: ElementALaUne;
}

function ElementShareRow({ el }: ElementShareRowProps) {
  return (
    <View style={styles.elRow}>
      <Text style={styles.elNom}>{el.nom}</Text>
      <Text style={styles.elPrix}>{formatPrice(el.prix)}</Text>
    </View>
  );
}

// ─── Carte bloc actif ─────────────────────────────────────────────────────────

interface BlocActifCardProps {
  bloc: BlocALaUne;
  shopName: string;
  shopLogoUrl: string | null;
  shopPhone: string | null;
  isShopOpen: boolean;
}

function BlocActifCard({ bloc, shopName, shopLogoUrl, shopPhone, isShopOpen }: BlocActifCardProps) {
  const [, setTick] = useState(0);
  const [showStory, setShowStory] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const countdown = formatCountdown(bloc.expire_at);

  return (
    <>
      <View style={styles.blocActifCard}>
        <View style={styles.blocActifHeader}>
          <View style={styles.blocActifLeft}>
            <Text style={styles.blocTitre}>{bloc.titre}</Text>
            {bloc.description ? <Text style={styles.blocDesc}>{bloc.description}</Text> : null}
          </View>
          <View style={styles.countdownChip}>
            <IcoClock />
            <Text style={styles.countdownTxt}>{countdown}</Text>
          </View>
        </View>
        <View style={styles.elList}>
          {bloc.elements.map(el => (
            <ElementShareRow key={el.id} el={el} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => setShowStory(true)}
          style={styles.shareBlocBtn}
          activeOpacity={0.8}
        >
          <IcoShareUp />
          <Text style={styles.shareBlocTxt}>Partager le bloc complet</Text>
        </TouchableOpacity>
        <View style={styles.lassiTag}>
          <IcoSparkle />
          <Text style={styles.lassiTagTxt}>Message généré par LASSİ · non modifiable</Text>
        </View>
      </View>

      <StoryShareModal
        visible={showStory}
        onClose={() => setShowStory(false)}
        bloc={bloc}
        shopName={shopName}
        shopLogoUrl={shopLogoUrl}
        shopPhone={shopPhone}
        isShopOpen={isShopOpen}
        countdown={countdown}
      />
    </>
  );
}

// ─── Item historique ──────────────────────────────────────────────────────────

interface HistoItemProps {
  bloc: BlocALaUne;
  restants: number;
  onReactiver: (id: string) => void;
  loading: boolean;
}

function HistoItem({ bloc, restants, onReactiver, loading }: HistoItemProps) {
  const date = new Date(bloc.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  return (
    <View style={styles.histoCard}>
      <View style={styles.histoTop}>
        <Text style={styles.histoTitre}>{bloc.titre}</Text>
        <Text style={styles.histoDate}>{date}</Text>
      </View>
      <Text style={styles.histoEls}>
        {bloc.elements.length === 0
          ? 'Affiche · image uniquement'
          : `${bloc.elements.length} élément${bloc.elements.length > 1 ? 's' : ''} · ${bloc.elements.map(e => e.nom).join(', ')}`}
      </Text>
      <TouchableOpacity
        style={[styles.reactiverBtn, (restants === 0 || loading) && styles.btnDisabled]}
        onPress={() => onReactiver(bloc.id)}
        disabled={restants === 0 || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : (
          <Text style={styles.reactiverTxt}>{restants === 0 ? 'Quota atteint' : 'Réactiver (1 quota)'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Modal de création ────────────────────────────────────────────────────────

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface CreerModalProps {
  visible: boolean;
  onClose: () => void;
  onCreer: (titre: string, desc: string, elements: ElementALaUne[], imageUri: string | null) => Promise<void>;
  loading: boolean;
  quotaRestants: number;
}

function CreerModal({ visible, onClose, onCreer, loading, quotaRestants }: CreerModalProps) {
  const [titre, setTitre] = useState('');
  const [desc, setDesc] = useState('');
  const [elements, setElements] = useState<ElementALaUne[]>([
    { id: shortId(), nom: '', prix: 0 },
  ]);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const reset = () => {
    setTitre('');
    setDesc('');
    setElements([{ id: shortId(), nom: '', prix: 0 }]);
    setImageUri(null);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  const addElement = () => {
    if (elements.length >= 20) return;
    setElements(els => [...els, { id: shortId(), nom: '', prix: 0 }]);
  };

  const updateEl = (id: string, field: 'nom' | 'prix', value: string) => {
    setElements(els =>
      els.map(e => (e.id === id ? { ...e, [field]: field === 'prix' ? Number(value) || 0 : value } : e)),
    );
  };

  const removeEl = (id: string) => {
    if (elements.length <= 1) return;
    setElements(els => els.filter(e => e.id !== id));
  };

  const handleSubmit = async () => {
    if (!titre.trim()) { Alert.alert('Titre requis', 'Donnez un titre à votre bloc.'); return; }
    const valid = elements.filter(e => e.nom.trim());
    if (valid.length === 0) { Alert.alert('Éléments requis', 'Ajoutez au moins un élément.'); return; }
    await onCreer(titre.trim(), desc.trim(), valid.map(e => ({ ...e, nom: e.nom.trim() })), imageUri);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouveau bloc À la une</Text>
            <TouchableOpacity onPress={handleClose} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalQuotaInfo, { color: quotaRestants === 0 ? colors.danger : colors.accent }]}>
            Il vous reste {quotaRestants}/10 blocs aujourd'hui
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
                <Text style={styles.fieldLabel}>Titre *</Text>
                <TextInput
                  style={styles.textInput}
                  value={titre}
                  onChangeText={t => setTitre(t.slice(0, 80))}
                  placeholder="Ex: Spécial midi, Offre éclair…"
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                />
                <Text style={styles.charCount}>{titre.length}/80</Text>

                <Text style={styles.fieldLabel}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={desc}
                  onChangeText={t => setDesc(t.slice(0, 300))}
                  placeholder="Détails de l'offre, horaires…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                />
                <Text style={styles.charCount}>{desc.length}/300</Text>

                <Text style={styles.fieldLabel}>Image (optionnel)</Text>
                {imageUri ? (
                  <View style={styles.imagePreviewBox}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageUri(null)}>
                      <Text style={styles.imageRemoveTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerRow}>
                    <TouchableOpacity style={styles.imagePickerBtn} onPress={pickFromGallery} activeOpacity={0.7}>
                      <IcoGallery stroke={colors.accent} />
                      <Text style={styles.imagePickerTxt}>Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imagePickerBtn} onPress={pickFromCamera} activeOpacity={0.7}>
                      <IcoCamera stroke={colors.accent} />
                      <Text style={styles.imagePickerTxt}>Appareil photo</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.elHeaderRow}>
                  <Text style={styles.fieldLabel}>Éléments ({elements.length}/20)</Text>
                  {elements.length < 20 && (
                    <TouchableOpacity onPress={addElement} style={styles.addElBtn}>
                      <IcoPlus stroke={colors.accent} />
                      <Text style={styles.addElTxt}>Ajouter</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {elements.map((el, idx) => (
                  <View key={el.id} style={styles.elInputRow}>
                    <View style={styles.elInputLeft}>
                      <TextInput
                        style={styles.elInputNom}
                        value={el.nom}
                        onChangeText={v => updateEl(el.id, 'nom', v)}
                        placeholder={`Élément ${idx + 1}`}
                        placeholderTextColor={colors.muted}
                      />
                      <TextInput
                        style={styles.elInputPrix}
                        value={el.prix > 0 ? String(el.prix) : ''}
                        onChangeText={v => updateEl(el.id, 'prix', v)}
                        placeholder="Prix (F)"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                      />
                    </View>
                    {elements.length > 1 && (
                      <TouchableOpacity onPress={() => removeEl(el.id)} style={styles.elRemoveBtn}>
                        <IcoTrash stroke={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator color={colors.bg} /> : (
                    <Text style={styles.submitTxt}>Publier le bloc (24h)</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function AlaUneScreen({ onBack }: Props) {
  const shopName = useShopStore(s => s.profile?.name ?? 'Ma boutique');
  const shopLogoUrl = useShopStore(s => s.profile?.logoUrl ?? null);
  const shopPhone = useShopStore(s => s.profile?.phone ?? null);
  const openingHours = useShopStore(s => s.context.openingHours);
  const isManuallyClose = useShopStore(s => s.context.isManuallyClose);
  const isShopOpen = computeStatus(openingHours as WeekHours | null, isManuallyClose).isOpen;
  const shopCategorieId = useShopStore(s => s.context.category ?? '');

  const [actifs, setActifs] = useState<BlocALaUne[]>([]);
  const [historique, setHistorique] = useState<BlocALaUne[]>([]);
  const [quota, setQuota] = useState<{ utilises: number; restants: number }>({ utilises: 0, restants: 10 });
  const [loading, setLoading] = useState(true);
  const [showCreer, setShowCreer] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [blocs, q] = await Promise.all([getMesBlocs(), getQuotaDuJour()]);
      setActifs(blocs.actifs);
      setHistorique(blocs.historique);
      setQuota(q);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreer = async (titre: string, desc: string, elements: ElementALaUne[], imageUri: string | null) => {
    if (!shopCategorieId) {
      Alert.alert('Boutique manquante', 'Configurez votre boutique avant de créer un bloc.');
      return;
    }
    setSubmitting(true);
    let imageUrl: string | null = null;
    if (imageUri) {
      const uploadResult = await uploadBlocImage(imageUri);
      if ('error' in uploadResult) {
        setSubmitting(false);
        Alert.alert("Erreur d'upload", uploadResult.error);
        return;
      }
      imageUrl = uploadResult.url;
    }
    const result = await creerBloc({
      titre,
      description: desc || undefined,
      categorieId: shopCategorieId,
      elements,
      imageUrl,
    });
    setSubmitting(false);
    if (!result.success) {
      Alert.alert('Impossible de créer', result.error ?? 'Erreur inconnue.');
      return;
    }
    setShowCreer(false);
    await refresh();
  };

  const handleReactiver = (blocId: string) => {
    if (quota.restants === 0) return;
    Alert.alert(
      'Réactiver ce bloc ?',
      'Le bloc sera republié pour 24h et consomme 1 quota du jour.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réactiver',
          onPress: async () => {
            setReactivatingId(blocId);
            const result = await reactiverBloc(blocId);
            setReactivatingId(null);
            if (!result.success) {
              Alert.alert('Impossible', result.error ?? 'Erreur.');
              return;
            }
            await refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <IcoFlame stroke={colors.accent} />
          <Text style={styles.headerTitle}>À la une</Text>
        </View>
        <View style={styles.quotaBadge}>
          <Text style={styles.quotaTxt}>{quota.restants}/10</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* CTA Créer */}
          <TouchableOpacity
            style={[styles.createBtn, quota.restants === 0 && styles.btnDisabled]}
            onPress={() => setShowCreer(true)}
            disabled={quota.restants === 0}
            activeOpacity={0.8}
          >
            <IcoPlus stroke={quota.restants === 0 ? colors.muted : colors.bg} />
            <Text style={[styles.createBtnTxt, quota.restants === 0 && { color: colors.muted }]}>
              {quota.restants === 0 ? 'Quota journalier atteint' : 'Créer un bloc À la une'}
            </Text>
          </TouchableOpacity>

          {quota.utilises > 0 && (
            <Text style={styles.quotaInfo}>
              {quota.utilises} bloc{quota.utilises > 1 ? 's' : ''} créé{quota.utilises > 1 ? 's' : ''} aujourd'hui · {quota.restants} restant{quota.restants > 1 ? 's' : ''} (réactivation = 1 quota)
            </Text>
          )}

          {/* Blocs actifs */}
          {actifs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>En cours</Text>
              {actifs.map(b => (
                <BlocActifCard
                  key={b.id}
                  bloc={b}
                  shopName={shopName}
                  shopLogoUrl={shopLogoUrl}
                  shopPhone={shopPhone}
                  isShopOpen={isShopOpen}
                />
              ))}
            </>
          )}

          {actifs.length === 0 && (
            <View style={styles.emptyBox}>
              <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z" stroke={colors.accent} />
              </Svg>
              <Text style={styles.emptyTxt}>
                Aucun bloc actif pour l'instant.{'\n'}Créez votre premier bloc À la une.
              </Text>
            </View>
          )}

          {/* Historique */}
          {historique.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Historique</Text>
              {historique.map(b => (
                <HistoItem
                  key={b.id}
                  bloc={b}
                  restants={quota.restants}
                  onReactiver={handleReactiver}
                  loading={reactivatingId === b.id}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <CreerModal
        visible={showCreer}
        onClose={() => setShowCreer(false)}
        onCreer={handleCreer}
        loading={submitting}
        quotaRestants={quota.restants}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  quotaBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quotaTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginBottom: 8,
  },
  createBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

  quotaInfo: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 20,
  },

  sectionTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginTop: 24,
    marginBottom: 12,
  },

  blocActifCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  blocActifHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  blocActifLeft: { flex: 1 },
  blocTitre: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  blocDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '20',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdownTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11.5 },

  elList: { gap: 6 },
  elRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 10,
  },
  elNom: { flex: 1, color: colors.white, fontFamily: fonts.label, fontSize: 13 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },

  shareBlocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBlocTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 12.5 },

  lassiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  lassiTagTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, fontStyle: 'italic' },

  histoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  histoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  histoTitre: { color: colors.white, fontFamily: fonts.label, fontSize: 13, flex: 1 },
  histoDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, marginLeft: 8 },
  histoEls: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginBottom: 10 },
  reactiverBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  reactiverTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },

  emptyBox: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: {},
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    maxHeight: '92%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  modalQuotaInfo: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  modalClose: { padding: 4 },
  modalCloseTxt: { color: colors.muted, fontSize: 18 },
  modalBody: { flex: 1 },

  fieldLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 12, marginBottom: 6 },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 2,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 14,
  },

  imagePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  imagePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  imagePickerTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12.5,
  },
  imagePreviewBox: {
    marginBottom: 16,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 280,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#00000080',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveTxt: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 14,
  },

  elHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addElBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addElTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },

  elInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  elInputLeft: { flex: 1, flexDirection: 'row', gap: 8 },
  elInputNom: {
    flex: 2,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  elInputPrix: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  elRemoveBtn: { padding: 6 },

  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
});

