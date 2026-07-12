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
  Share,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import useShopStore from '../../store/shopStore';
import {
  getMesBlocs,
  creerBloc,
  reactiverBloc,
  getQuotaDuJour,
  buildShareMessage,
} from '../../services/aLaUne';
import { partagerBloc } from '../../utils/aLaUneLinks';
import { getCatConfig, type CatId } from '../../config/categories';
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

const IcoTrash = ({ stroke }: { stroke: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={stroke} />
  </Svg>
);

const IcoWhatsApp = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={11} fill="#25D366" />
    <Path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.2-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.2-.5 0-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.1 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.6.2-1.1.2-1.2-.2-.1-.4-.2-.6-.2z" fill="#fff" />
  </Svg>
);

const IcoFacebook = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={11} fill="#1877F2" />
    <Path d="M15.5 8H13V6.5c0-.6.4-1 1-1h1.5V3h-2C11.7 3 10.5 4.2 10.5 6v2H9v2.5h1.5V21h3V10.5H15l.5-2.5z" fill="#fff" />
  </Svg>
);

const IcoInstagram = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={11} fill="#E1306C" />
    <Rect x={7} y={7} width={10} height={10} rx={3} stroke="#fff" strokeWidth={1.5} />
    <Circle cx={12} cy={12} r={2.5} stroke="#fff" strokeWidth={1.5} />
    <Circle cx={15.5} cy={8.5} r={0.8} fill="#fff" />
  </Svg>
);

const IcoTikTok = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={11} fill="#010101" />
    <Path d="M16 8.5c-.9-.6-1.5-1.6-1.5-2.7h-2v9.2c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8c.2 0 .4 0 .5.1V11c-.2 0-.3 0-.5 0-2.1 0-3.8 1.7-3.8 3.8S8.6 18.6 10.7 18.6s3.8-1.7 3.8-3.8V10c.7.5 1.6.8 2.5.8V8.6c-.4 0-.7-.1-1-.1z" fill="#fff" />
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

// ─── Partage par élément ──────────────────────────────────────────────────────

interface ElementShareRowProps {
  el: ElementALaUne;
  bloc: BlocALaUne;
  shopName: string;
}

function ElementShareRow({ el, bloc, shopName }: ElementShareRowProps) {
  const message = buildShareMessage({
    elementNom: el.nom,
    elementPrix: el.prix,
    elementId: el.id,
    blocTitre: bloc.titre,
    blocDescription: bloc.description,
    shopName,
    blocId: bloc.id,
    expireAt: bloc.expire_at,
  });

  const shareToWhatsApp = async () => {
    const encoded = encodeURIComponent(message);
    try {
      const can = await Linking.canOpenURL('whatsapp://send?text=a');
      if (can) { await Linking.openURL(`whatsapp://send?text=${encoded}`); return; }
    } catch {}
    Share.share({ message });
  };

  const shareGeneric = () => Share.share({ message });

  return (
    <View style={styles.elRow}>
      <View style={styles.elInfo}>
        <Text style={styles.elNom}>{el.nom}</Text>
        <Text style={styles.elPrix}>{formatPrice(el.prix)}</Text>
      </View>
      <View style={styles.elShare}>
        <TouchableOpacity onPress={shareToWhatsApp} style={styles.shareBtn}><IcoWhatsApp /></TouchableOpacity>
        <TouchableOpacity onPress={shareGeneric} style={styles.shareBtn}><IcoFacebook /></TouchableOpacity>
        <TouchableOpacity onPress={shareGeneric} style={styles.shareBtn}><IcoInstagram /></TouchableOpacity>
        <TouchableOpacity onPress={shareGeneric} style={styles.shareBtn}><IcoTikTok /></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Carte bloc actif ─────────────────────────────────────────────────────────

interface BlocActifCardProps {
  bloc: BlocALaUne;
  shopName: string;
  categorieId: string;
  nomCategorie: string;
}

function BlocActifCard({ bloc, shopName, categorieId, nomCategorie }: BlocActifCardProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleShareBloc = () => partagerBloc(bloc, nomCategorie);

  return (
    <View style={styles.blocActifCard}>
      <View style={styles.blocActifHeader}>
        <View style={styles.blocActifLeft}>
          <Text style={styles.blocTitre}>{bloc.titre}</Text>
          {bloc.description ? <Text style={styles.blocDesc}>{bloc.description}</Text> : null}
        </View>
        <View style={styles.countdownChip}>
          <Text style={styles.countdownTxt}>⏳ {formatCountdown(bloc.expire_at)}</Text>
        </View>
      </View>
      <View style={styles.elList}>
        {bloc.elements.map(el => (
          <ElementShareRow key={el.id} el={el} bloc={bloc} shopName={shopName} />
        ))}
      </View>
      <TouchableOpacity onPress={handleShareBloc} style={styles.shareBlocBtn} activeOpacity={0.8}>
        <Text style={styles.shareBlocTxt}>📤 Partager le bloc complet</Text>
      </TouchableOpacity>
      <View style={styles.lassiTag}>
        <Text style={styles.lassiTagTxt}>✨ Message généré par LASSİ · non modifiable</Text>
      </View>
    </View>
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
        {bloc.elements.length} élément{bloc.elements.length > 1 ? 's' : ''} · {bloc.elements.map(e => e.nom).join(', ')}
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

interface CreerModalProps {
  visible: boolean;
  onClose: () => void;
  onCreer: (titre: string, desc: string, elements: ElementALaUne[]) => Promise<void>;
  loading: boolean;
}

function CreerModal({ visible, onClose, onCreer, loading }: CreerModalProps) {
  const [titre, setTitre] = useState('');
  const [desc, setDesc] = useState('');
  const [elements, setElements] = useState<ElementALaUne[]>([
    { id: `el-${Date.now()}`, nom: '', prix: 0 },
  ]);

  const reset = () => {
    setTitre('');
    setDesc('');
    setElements([{ id: `el-${Date.now()}`, nom: '', prix: 0 }]);
  };

  const handleClose = () => { reset(); onClose(); };

  const addElement = () => {
    if (elements.length >= 20) return;
    setElements(els => [...els, { id: `el-${Date.now()}`, nom: '', prix: 0 }]);
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
    await onCreer(titre.trim(), desc.trim(), valid.map(e => ({ ...e, nom: e.nom.trim() })));
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouveau bloc À la une</Text>
            <TouchableOpacity onPress={handleClose} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
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
            <View style={{ height: 20 }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.submitTxt}>Publier le bloc (24h)</Text>}
          </TouchableOpacity>
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
  const shopCategorieId = useShopStore(s => s.context.category ?? '');
  const nomCategorie = getCatConfig(shopCategorieId as CatId)?.label ?? shopCategorieId;

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

  const handleCreer = async (titre: string, desc: string, elements: ElementALaUne[]) => {
    if (!shopCategorieId) {
      Alert.alert('Boutique manquante', 'Configurez votre boutique avant de créer un bloc.');
      return;
    }
    setSubmitting(true);
    const result = await creerBloc({
      titre,
      description: desc || undefined,
      categorieId: shopCategorieId,
      elements,
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
                  categorieId={shopCategorieId}
                  nomCategorie={nomCategorie}
                />
              ))}
            </>
          )}

          {actifs.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🌟</Text>
              <Text style={styles.emptyTxt}>
                Aucun bloc actif pour l'instant.{'\n'}Créez votre premier bloc À la une !
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
    backgroundColor: colors.accent + '20',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdownTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11.5 },

  elList: { gap: 8 },
  elRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 10,
  },
  elInfo: { flex: 1 },
  elNom: { color: colors.white, fontFamily: fonts.label, fontSize: 13 },
  elPrix: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  elShare: { flexDirection: 'row', gap: 6 },
  shareBtn: { padding: 2 },

  shareBlocBtn: {
    marginTop: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBlocTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 12.5 },

  lassiTag: {
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
  emptyIcon: { fontSize: 36, marginBottom: 12 },
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
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  modalClose: { padding: 4 },
  modalCloseTxt: { color: colors.muted, fontSize: 18 },
  modalBody: { flexGrow: 0 },

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
