import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert, TextInput, Switch, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { TOP_INSET } from '../../theme';
import { BeautyTimeSlot } from '../../types/beautyAppointment';
import {
  getAllBeautyTimeSlots,
  upsertBeautyTimeSlot,
  deleteBeautyTimeSlot,
} from '../../services/beautyAppointments';
import { getMonProfilVip } from '../../services/vip';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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

// ─── Formulaire ──────────────────────────────────────────────────────────────

interface FormState {
  id?: string;
  label: string;
  heure_debut: string;
  heure_fin: string;
  jours_semaine: number[];
  max_reservations: string;
  actif: boolean;
}

const FORM_VIDE: FormState = {
  label: '', heure_debut: '', heure_fin: '',
  jours_semaine: [1, 2, 3, 4, 5, 6],
  max_reservations: '1', actif: true,
};

function slotToForm(sl: BeautyTimeSlot): FormState {
  return {
    id:               sl.id,
    label:            sl.label,
    heure_debut:      sl.heure_debut,
    heure_fin:        sl.heure_fin,
    jours_semaine:    [...sl.jours_semaine],
    max_reservations: String(sl.max_reservations),
    actif:            sl.actif,
  };
}

interface FormModalProps {
  visible: boolean;
  initial: FormState;
  profilId: string;
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ visible, initial, profilId, onClose, onSaved }: FormModalProps) {
  const [form, setForm]   = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial); }, [initial, visible]);

  const maj = (champ: Partial<FormState>) => setForm(f => ({ ...f, ...champ }));

  const toggleJour = (j: number) => {
    setForm(f => ({
      ...f,
      jours_semaine: f.jours_semaine.includes(j)
        ? f.jours_semaine.filter(x => x !== j)
        : [...f.jours_semaine, j].sort((a, b) => a - b),
    }));
  };

  const sauvegarder = async () => {
    if (!form.label.trim()) return Alert.alert('Label requis', 'Donnez un nom à ce créneau (ex : Matin).');
    const heureRe = /^\d{2}:\d{2}$/;
    if (!heureRe.test(form.heure_debut)) return Alert.alert('Heure invalide', 'Format attendu : HH:MM');
    if (!heureRe.test(form.heure_fin))   return Alert.alert('Heure invalide', 'Format attendu : HH:MM');
    if (form.jours_semaine.length === 0) return Alert.alert('Jours requis', 'Sélectionnez au moins un jour.');
    const max = Number(form.max_reservations);
    if (isNaN(max) || max < 1 || max > 20) return Alert.alert('Capacité invalide', 'Entre 1 et 20.');

    setSaving(true);
    try {
      await upsertBeautyTimeSlot({
        ...(form.id ? { id: form.id } : {}),
        vip_profil_id:    profilId,
        label:            form.label.trim(),
        heure_debut:      form.heure_debut,
        heure_fin:        form.heure_fin,
        jours_semaine:    form.jours_semaine,
        max_reservations: max,
        actif:            form.actif,
        position:         0,
      } as BeautyTimeSlot & { vip_profil_id: string });
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer le créneau.');
    } finally {
      setSaving(false);
    }
  };

  const supprimer = () => {
    if (!form.id) return;
    Alert.alert('Supprimer', `Supprimer le créneau « ${form.label} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try { await deleteBeautyTimeSlot(form.id!); onSaved(); onClose(); }
          catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sf.fond}>
        <View style={sf.handle} />
        <View style={sf.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={sf.annuler}>Annuler</Text>
          </TouchableOpacity>
          <Text style={sf.titre}>{form.id ? 'Modifier' : 'Nouveau créneau'}</Text>
          <TouchableOpacity onPress={sauvegarder} disabled={saving}>
            {saving
              ? <ActivityIndicator color={r.couleur.or} size="small" />
              : <Text style={sf.sauver}>Enreg.</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={sf.scroll} keyboardShouldPersistTaps="handled">
          <Champ label="Nom du créneau *" value={form.label} onChange={v => maj({ label: v })} placeholder="Ex : Matin, Après-midi" />
          <Champ label="Heure début *" value={form.heure_debut} onChange={v => maj({ heure_debut: v })} placeholder="09:00" keyboardType="numeric" />
          <Champ label="Heure fin *" value={form.heure_fin} onChange={v => maj({ heure_fin: v })} placeholder="12:00" keyboardType="numeric" />
          <Champ label="Places simultanées *" value={form.max_reservations} onChange={v => maj({ max_reservations: v })} placeholder="1" keyboardType="numeric" hint="Combien de clients peuvent réserver ce créneau le même jour" />

          <Text style={sf.champLabel}>Jours disponibles *</Text>
          <View style={sf.joursRow}>
            {JOURS.map((j, idx) => {
              const on = form.jours_semaine.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[sf.jourChip, on && sf.jourChipOn]}
                  onPress={() => toggleJour(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[sf.jourTxt, on && sf.jourTxtOn]}>{j}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={sf.switchLigne}>
            <Text style={sf.switchLabel}>Actif</Text>
            <Switch
              value={form.actif}
              onValueChange={v => maj({ actif: v })}
              thumbColor={form.actif ? r.couleur.or : r.couleur.gris}
              trackColor={{ false: r.couleur.velours, true: 'rgba(201,162,39,0.4)' }}
            />
          </View>

          {form.id && (
            <TouchableOpacity style={sf.btnSupp} onPress={supprimer}>
              <Text style={sf.btnSuppTxt}>Supprimer ce créneau</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Champ({ label, value, onChange, placeholder, keyboardType, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric'; hint?: string;
}) {
  return (
    <View style={sf.champBloc}>
      <Text style={sf.champLabel}>{label}</Text>
      {hint && <Text style={sf.champHint}>{hint}</Text>}
      <TextInput
        style={sf.champInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={r.couleur.gris}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function GerantCreneauxBeautyScreen({ onBack }: Props) {
  const [profilId, setProfilId] = useState('');
  const [slots, setSlots]       = useState<BeautyTimeSlot[]>([]);
  const [loading, setLoading]   = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [formInitial, setFormInitial] = useState<FormState>(FORM_VIDE);

  const charger = useCallback(async () => {
    setLoading(true);
    const profil = await getMonProfilVip();
    if (profil) {
      setProfilId(profil.id);
      const data = await getAllBeautyTimeSlots(profil.id);
      setSlots(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  return (
    <View style={s.fond}>
      <View style={[s.header, { paddingTop: TOP_INSET + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitre}>Mes créneaux</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={s.legende}>Configurez les horaires disponibles pour vos clients.</Text>

      {loading ? (
        <View style={s.centre}><ActivityIndicator color={r.couleur.or} /></View>
      ) : (
        <ScrollView>
          {slots.length === 0 && (
            <Text style={s.vide}>Aucun créneau.{'\n'}Appuyez sur + pour en ajouter.</Text>
          )}
          {slots.map(sl => (
            <TouchableOpacity
              key={sl.id}
              style={s.row}
              onPress={() => { setFormInitial(slotToForm(sl)); setFormVisible(true); }}
              activeOpacity={0.82}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{sl.label}</Text>
                <Text style={s.rowHeure}>{sl.heure_debut} – {sl.heure_fin}</Text>
                <Text style={s.rowJours}>
                  {sl.jours_semaine.map(j => JOURS[j]).join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.rowMax}>{sl.max_reservations} place{sl.max_reservations > 1 ? 's' : ''}</Text>
                <View style={[s.actifBadge, !sl.actif && s.inactifBadge]}>
                  <Text style={[s.actifTxt, !sl.actif && s.inactifTxt]}>{sl.actif ? 'Actif' : 'Inactif'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => { setFormInitial(FORM_VIDE); setFormVisible(true); }}>
        <IcoPlus />
      </TouchableOpacity>

      {profilId !== '' && (
        <FormModal
          visible={formVisible}
          initial={formInitial}
          profilId={profilId}
          onClose={() => setFormVisible(false)}
          onSaved={charger}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: r.espace.md, paddingBottom: r.espace.md,
    borderBottomWidth: 1, borderBottomColor: r.couleur.filetFin,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitre: {
    flex: 1, fontFamily: VIP_FONTS.palais.titre, fontSize: 18,
    color: r.couleur.ivoire, letterSpacing: 1.5, textAlign: 'center',
  },

  legende: {
    paddingHorizontal: r.espace.md, paddingVertical: 10,
    fontFamily: VIP_FONTS.palais.util, fontSize: 12, color: r.couleur.gris,
    borderBottomWidth: 1, borderBottomColor: r.couleur.filetFin,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: r.espace.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: r.couleur.filetFin,
  },
  rowLabel: { fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.ivoire },
  rowHeure: { fontFamily: VIP_FONTS.palais.util, fontSize: 12, color: r.couleur.orClair, marginTop: 2 },
  rowJours: { fontFamily: VIP_FONTS.palais.util, fontSize: 11, color: r.couleur.gris,    marginTop: 2 },
  rowMax:   { fontFamily: VIP_FONTS.palais.util, fontSize: 11, color: r.couleur.gris },
  actifBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, backgroundColor: 'rgba(127,207,156,0.15)',
  },
  inactifBadge: { backgroundColor: 'rgba(255,255,255,0.06)' },
  actifTxt:  { fontFamily: VIP_FONTS.palais.util, fontSize: 10, color: '#7FCF9C' },
  inactifTxt:{ color: r.couleur.gris },

  vide: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 14,
    color: r.couleur.gris, textAlign: 'center', marginTop: 60, lineHeight: 24,
  },
  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center', justifyContent: 'center',
  },
});

const sf = StyleSheet.create({
  fond: { flex: 1, backgroundColor: r.couleur.encre },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: r.couleur.filet,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: r.espace.md, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: r.couleur.filetFin,
  },
  annuler: { fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.gris },
  titre:   { fontFamily: VIP_FONTS.palais.titre, fontSize: 16, color: r.couleur.ivoire, letterSpacing: 1.5 },
  sauver:  { fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.orLassi },

  champBloc: { paddingHorizontal: r.espace.md, paddingTop: r.espace.sm },
  champLabel: {
    fontFamily: VIP_FONTS.palais.util, fontSize: 10, letterSpacing: 2,
    color: r.couleur.orClair, textTransform: 'uppercase', marginBottom: 4,
  },
  champHint: { fontFamily: VIP_FONTS.palais.util, fontSize: 11, color: r.couleur.gris, marginBottom: 4 },
  champInput: {
    borderWidth: 1, borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours, color: r.couleur.ivoire,
    fontFamily: VIP_FONTS.palais.util, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },

  joursRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: r.espace.md, paddingTop: 8,
  },
  jourChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: r.couleur.filetFin,
    backgroundColor: r.couleur.velours,
  },
  jourChipOn: { borderColor: r.couleur.orLassi, backgroundColor: 'rgba(201,162,39,0.15)' },
  jourTxt:    { fontFamily: VIP_FONTS.palais.util, fontSize: 12, color: r.couleur.gris },
  jourTxtOn:  { color: r.couleur.orLassi },

  switchLigne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: r.espace.md, paddingTop: r.espace.md,
  },
  switchLabel: { fontFamily: VIP_FONTS.palais.util, fontSize: 14, color: r.couleur.ivoire },

  btnSupp: {
    marginHorizontal: r.espace.md, marginTop: r.espace.lg,
    paddingVertical: 12, borderWidth: 1, borderColor: '#7a3333', alignItems: 'center',
  },
  btnSuppTxt: { fontFamily: VIP_FONTS.palais.util, fontSize: 13, color: '#E07070' },
});
