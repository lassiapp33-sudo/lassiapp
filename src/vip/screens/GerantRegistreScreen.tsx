import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { VipPrestation } from '../../types/vip';
import {
  deletePrestation,
  getMonPrestations,
  getMonProfilVip,
  setSignaturePrestation,
  toggleDisponibilite,
  upsertPrestation,
} from '../../services/vip';
import useGerantStore from '../../store/gerantStore';
import { TOP_INSET } from '../../theme';
import { VipCategorie } from '../../types/vip';

// ─── Suggestions par catégorie ────────────────────────────────────────────────

interface Suggestions {
  section: string;
  nom: string;
  description: string;
  unite: string;
  mention: string;
}

const SUGGESTIONS: Record<VipCategorie, Suggestions> = {
  restauration: {
    section:     'Ex : Entrées',
    nom:         'Ex : Thiéboudienne royale',
    description: 'Riz au poisson fumé, légumes du marché...',
    unite:       'Ex : portion, plat, boisson',
    mention:     'Ex : Nouveau · Populaire',
  },
  beaute_tressage: {
    section:     'Ex : Tressage',
    nom:         'Ex : Box braids mi-long',
    description: 'Pose complète avec rajouts inclus...',
    unite:       'Ex : séance, pose',
    mention:     'Ex : Best-seller · Nouveau',
  },
  coiffure: {
    section:     'Ex : Coupes',
    nom:         'Ex : Coupe + défrisage',
    description: 'Shampoing, soin, coupe et mise en plis...',
    unite:       'Ex : séance',
    mention:     'Ex : Populaire · Nouveau',
  },
  musculation_fitness: {
    section:     'Ex : Abonnements',
    nom:         'Ex : Abonnement mensuel',
    description: 'Accès illimité à la salle + cours collectifs...',
    unite:       'Ex : mois, séance',
    mention:     'Ex : Nouveau · Populaire',
  },
  boulangerie_patisserie: {
    section:     'Ex : Viennoiseries',
    nom:         'Ex : Croissant beurre',
    description: 'Feuilletage pur beurre, doré au four...',
    unite:       'Ex : pièce, kg',
    mention:     'Ex : Nouveau · Populaire',
  },
};

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoPlus = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.encre} strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const IcoEdit = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.gris} strokeWidth={1.5} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

const IcoStar = ({ plein }: { plein: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={plein ? r.couleur.or : 'none'}
    stroke={r.couleur.or} strokeWidth={1.5}>
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </Svg>
);

const IcoUp = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.gris} strokeWidth={2} strokeLinecap="round">
    <Path d="M18 15l-6-6-6 6" />
  </Svg>
);

const IcoDown = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.gris} strokeWidth={2} strokeLinecap="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

// ─── Formulaire prestation ────────────────────────────────────────────────────

interface FormState {
  id?: string;
  section: string;
  nom: string;
  description: string;
  prix: string;
  prixBarre: string;
  unite: string;
  mention: string;
  disponible: boolean;
}

const FORM_VIDE: FormState = {
  section: '', nom: '', description: '', prix: '',
  prixBarre: '', unite: '', mention: '', disponible: true,
};

function prestationToForm(p: VipPrestation): FormState {
  return {
    id: p.id,
    section: p.section,
    nom: p.nom,
    description: p.description ?? '',
    prix: String(p.prix),
    prixBarre: p.prixBarre != null ? String(p.prixBarre) : '',
    unite: p.unite ?? '',
    mention: p.mention ?? '',
    disponible: p.disponible,
  };
}

interface FormModalProps {
  visible: boolean;
  initial: FormState;
  profilId: string;
  categorie: VipCategorie;
  sectionsExistantes: string[];
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ visible, initial, profilId, categorie, sectionsExistantes, onClose, onSaved }: FormModalProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const sg = SUGGESTIONS[categorie] ?? SUGGESTIONS.restauration;

  useEffect(() => { setForm(initial); }, [initial, visible]);

  const maj = (champ: Partial<FormState>) => setForm(f => ({ ...f, ...champ }));

  const sauvegarder = async () => {
    if (!form.nom.trim()) {
      Alert.alert('Nom requis', 'Entrez un nom pour la prestation.');
      return;
    }
    const prix = Number(form.prix.replace(',', '.'));
    if (isNaN(prix) || prix <= 0) {
      Alert.alert('Prix invalide', 'Entrez un prix valide en F CFA.');
      return;
    }
    setSaving(true);
    try {
      await upsertPrestation({
        id: form.id,
        vipProfilId: profilId,
        section: form.section.trim() || 'Carte',
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        prix,
        prixBarre: form.prixBarre ? Number(form.prixBarre.replace(',', '.')) : undefined,
        unite: form.unite.trim() || undefined,
        mention: form.mention.trim() || undefined,
        disponible: form.disponible,
      });
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la prestation.');
    } finally {
      setSaving(false);
    }
  };

  const supprimer = () => {
    if (!form.id) return;
    Alert.alert(
      'Supprimer',
      `Supprimer « ${form.nom} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deletePrestation(form.id!);
              onSaved();
              onClose();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sf.fond}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={sf.handle} />
        <View style={sf.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={sf.annuler}>Annuler</Text>
          </TouchableOpacity>
          <Text style={sf.modalTitre}>{form.id ? 'Modifier' : 'Ajouter'}</Text>
          <TouchableOpacity onPress={sauvegarder} disabled={saving}>
            {saving
              ? <ActivityIndicator color={r.couleur.or} size="small" />
              : <Text style={sf.sauver}>Enregist.</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={sf.scroll} keyboardShouldPersistTaps="handled">
          <LigneSection value={form.section} onChange={v => maj({ section: v })} sections={sectionsExistantes} sectionPlaceholder={sg.section} />
          <Ligne label="Nom *" value={form.nom} onChange={v => maj({ nom: v })} placeholder={sg.nom} />
          <Ligne label="Description" value={form.description} onChange={v => maj({ description: v })} placeholder={sg.description} multiline />
          <Ligne label="Prix (F CFA) *" value={form.prix} onChange={v => maj({ prix: v })} placeholder="Ex : 4500" keyboardType="numeric" />
          <Ligne label="Prix barré (F CFA)" value={form.prixBarre} onChange={v => maj({ prixBarre: v })} placeholder="Ex : 5500 (facultatif)" keyboardType="numeric" />
          <Ligne label="Unité" value={form.unite} onChange={v => maj({ unite: v })} placeholder={sg.unite} />
          <Ligne label="Mention" value={form.mention} onChange={v => maj({ mention: v })} placeholder={sg.mention} />

          <View style={sf.switchLigne}>
            <Text style={sf.switchLabel}>Disponible</Text>
            <Switch
              value={form.disponible}
              onValueChange={v => maj({ disponible: v })}
              thumbColor={form.disponible ? r.couleur.or : r.couleur.gris}
              trackColor={{ false: r.couleur.velours, true: 'rgba(201,162,39,0.4)' }}
            />
          </View>

          {form.id && (
            <TouchableOpacity style={sf.btnSupp} onPress={supprimer}>
              <Text style={sf.btnSuppTxt}>Supprimer cette prestation</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Ligne({ label, value, onChange, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={sf.champBloc}>
      <Text style={sf.champLabel}>{label}</Text>
      <TextInput
        style={[sf.champInput, multiline && sf.champMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={r.couleur.gris}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

function LigneSection({ value, onChange, sections, sectionPlaceholder }: {
  value: string;
  onChange: (v: string) => void;
  sections: string[];
  sectionPlaceholder?: string;
}) {
  return (
    <View style={sf.champBloc}>
      <Text style={sf.champLabel}>Section</Text>
      {sections.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={sf.chipsScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 8 }}>
          {sections.map(sec => {
            const actif = value.trim().toLowerCase() === sec.trim().toLowerCase();
            return (
              <TouchableOpacity
                key={sec}
                style={[sf.chip, actif && sf.chipActif]}
                onPress={() => onChange(sec)}>
                <Text style={[sf.chipTxt, actif && sf.chipTxtActif]}>{sec}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <TextInput
        style={sf.champInput}
        value={value}
        onChangeText={onChange}
        placeholder={sections.length > 0 ? 'Nouvelle section...' : (sectionPlaceholder ?? 'Ex : Entrées')}
        placeholderTextColor={r.couleur.gris}
      />
    </View>
  );
}

// ─── Ligne prestation dans la liste ──────────────────────────────────────────

function RowPrestation({
  presta,
  profilId,
  onEdit,
  onMoved,
  onToggle,
  onSig,
}: {
  presta: VipPrestation;
  profilId: string;
  onEdit: () => void;
  onMoved: (newOrdre: number) => Promise<void>;
  onToggle: () => void;
  onSig: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [sigging, setSigging] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await toggleDisponibilite(presta.id, !presta.disponible);
      onToggle();
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité.');
    } finally {
      setToggling(false);
    }
  };

  const handleSig = async () => {
    setSigging(true);
    try {
      await setSignaturePrestation(profilId, presta.id);
      onSig();
    } catch {
      Alert.alert('Erreur', 'Impossible de définir comme signature.');
    } finally {
      setSigging(false);
    }
  };

  return (
    <View style={sr.row}>
      <View style={sr.gauche}>
        {/* Étoile signature */}
        <TouchableOpacity onPress={handleSig} disabled={sigging || presta.estSignature} style={sr.starBtn} hitSlop={6}>
          {sigging ? <ActivityIndicator size="small" color={r.couleur.or} /> : <IcoStar plein={presta.estSignature} />}
        </TouchableOpacity>
        <View style={sr.info}>
          <Text style={sr.nom} numberOfLines={1}>{presta.nom}</Text>
          <Text style={sr.section}>{presta.section}</Text>
        </View>
      </View>
      <View style={sr.droite}>
        <Text style={sr.prix}>{presta.prix.toLocaleString('fr-FR')} F</Text>
        {/* Disponible */}
        {toggling
          ? <ActivityIndicator size="small" color={r.couleur.or} style={sr.switch} />
          : (
            <Switch
              value={presta.disponible}
              onValueChange={handleToggle}
              thumbColor={presta.disponible ? r.couleur.or : r.couleur.gris}
              trackColor={{ false: r.couleur.velours, true: 'rgba(201,162,39,0.4)' }}
              style={sr.switch}
            />
          )}
        {/* Boutons ordre */}
        <View style={sr.ordreCol}>
          <TouchableOpacity hitSlop={4} onPress={() => onMoved(presta.ordre - 1)}>
            <IcoUp />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={4} onPress={() => onMoved(presta.ordre + 1)}>
            <IcoDown />
          </TouchableOpacity>
        </View>
        {/* Éditer */}
        <TouchableOpacity onPress={onEdit} hitSlop={6} style={sr.editBtn}>
          <IcoEdit />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function GerantRegistreScreen({ onBack }: Props) {
  const profilStore = useGerantStore(s => s.profil);
  const categorie = profilStore?.categorie ?? 'restauration';
  const [profilId, setProfilId] = useState<string>(profilStore?.id ?? '');
  const [prestations, setPrestations] = useState<VipPrestation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [formInitial, setFormInitial] = useState<FormState>(FORM_VIDE);

  const charger = useCallback(async () => {
    setChargement(true);
    const profil = await getMonProfilVip();
    if (profil) setProfilId(profil.id);
    const data = await getMonPrestations();
    setPrestations(data);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirAjout = () => {
    setFormInitial(FORM_VIDE);
    setFormVisible(true);
  };

  const ouvrirEdition = (p: VipPrestation) => {
    setFormInitial(prestationToForm(p));
    setFormVisible(true);
  };

  const deplacerOrdre = async (presta: VipPrestation, newOrdre: number) => {
    try {
      await upsertPrestation({
        id: presta.id,
        vipProfilId: profilId,
        section: presta.section,
        nom: presta.nom,
        description: presta.description ?? undefined,
        prix: presta.prix,
        prixBarre: presta.prixBarre ?? undefined,
        unite: presta.unite ?? undefined,
        mention: presta.mention ?? undefined,
        estSignature: presta.estSignature,
        disponible: presta.disponible,
        ordre: Math.max(0, newOrdre),
      });
      charger();
    } catch {}
  };

  // Grouper par section
  const sections = [...new Set(prestations.map(p => p.section))];

  return (
    <View style={s.fond}>
      <StatusBar barStyle="light-content" />

      {/* En-tête */}
      <View style={[s.header, { paddingTop: TOP_INSET + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitre}>Mon registre</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Légende */}
      <View style={s.legende}>
        <Text style={s.legendeTxt}>★ = signature · Disponible · Ordre · Modifier</Text>
      </View>

      {chargement ? (
        <View style={s.centre}><ActivityIndicator color={r.couleur.or} /></View>
      ) : (
        <ScrollView>
          {sections.map(sec => (
            <View key={sec}>
              <Text style={s.sectionTitre}>{sec}</Text>
              {prestations
                .filter(p => p.section === sec)
                .sort((a, b) => a.ordre - b.ordre)
                .map(p => (
                  <RowPrestation
                    key={p.id}
                    presta={p}
                    profilId={profilId}
                    onEdit={() => ouvrirEdition(p)}
                    onMoved={ordre => deplacerOrdre(p, ordre)}
                    onToggle={charger}
                    onSig={charger}
                  />
                ))}
            </View>
          ))}
          {prestations.length === 0 && (
            <Text style={s.vide}>Aucune prestation.{'\n'}Appuyez sur + pour commencer.</Text>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={ouvrirAjout}>
        <IcoPlus />
      </TouchableOpacity>

      {/* Formulaire modal */}
      {profilId !== '' && (
        <FormModal
          visible={formVisible}
          initial={formInitial}
          profilId={profilId}
          categorie={categorie}
          sectionsExistantes={sections}
          onClose={() => setFormVisible(false)}
          onSaved={charger}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingBottom: r.espace.md,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitre: {
    flex: 1,
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 18,
    color: r.couleur.ivoire,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  legende: {
    paddingHorizontal: r.espace.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  legendeTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    color: r.couleur.gris,
    letterSpacing: 1,
  },

  sectionTitre: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    letterSpacing: 3,
    color: r.couleur.orClair,
    textTransform: 'uppercase',
    paddingHorizontal: r.espace.md,
    paddingTop: 14,
    paddingBottom: 4,
  },

  vide: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.gris,
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 24,
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  gauche: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: r.espace.xs },
  starBtn: { padding: 2 },
  info: { flex: 1 },
  nom: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.ivoire,
  },
  section: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    color: r.couleur.gris,
    marginTop: 2,
  },
  droite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prix: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 12,
    color: r.couleur.orClair,
    minWidth: 60,
    textAlign: 'right',
  },
  switch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  ordreCol: { flexDirection: 'column', gap: 2 },
  editBtn: { padding: 4 },
});

const sf = StyleSheet.create({
  fond: { flex: 1, backgroundColor: r.couleur.encre },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: r.couleur.filet,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  scroll: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: r.espace.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  annuler: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.gris,
  },
  modalTitre: {
    fontFamily: VIP_FONTS.palais.titre, fontSize: 16,
    color: r.couleur.ivoire, letterSpacing: 1.5,
  },
  sauver: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.orLassi,
  },
  chipsScroll: { marginBottom: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    marginRight: 8,
    borderRadius: 2,
  },
  chipActif: {
    borderColor: r.couleur.orLassi,
    backgroundColor: 'rgba(201,162,39,0.15)',
  },
  chipTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 12,
    color: r.couleur.gris,
  },
  chipTxtActif: {
    color: r.couleur.orLassi,
  },
  champBloc: { paddingHorizontal: r.espace.md, paddingTop: r.espace.sm },
  champLabel: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 10, letterSpacing: 2,
    color: r.couleur.orClair, textTransform: 'uppercase', marginBottom: 5,
  },
  champInput: {
    borderWidth: 1, borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours, color: r.couleur.ivoire,
    fontFamily: VIP_FONTS.palais.util, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  champMulti: { height: 72, textAlignVertical: 'top' },
  switchLigne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: r.espace.md, paddingTop: r.espace.md,
  },
  switchLabel: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.ivoire,
  },
  btnSupp: {
    marginHorizontal: r.espace.md, marginTop: r.espace.lg,
    paddingVertical: 12, borderWidth: 1, borderColor: '#7a3333',
    alignItems: 'center',
  },
  btnSuppTxt: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 13, color: '#E07070',
  },
});
