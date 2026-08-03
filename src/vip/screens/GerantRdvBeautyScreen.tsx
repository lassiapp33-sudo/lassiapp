import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert,
  Modal, Pressable, Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { BeautyRdvGerant, STATUT_LABEL_BEAUTY, STATUT_COLOR_BEAUTY } from '../../types/beautyAppointment';
import { getBeautyRdvGerant, processBeautyAppointment } from '../../services/beautyAppointments';
import { getErrorMessage } from '../../utils/errorUtils';

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoCalendar = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke="#FDCF34" strokeWidth={1.5} fill="#FDCF3420"/>
    <Path d="M3 9h18" stroke="#FDCF34" strokeWidth={1.5}/>
    <Path d="M8 2v4M16 2v4" stroke="#FDCF34" strokeWidth={1.5} strokeLinecap="round"/>
    <Path d="M8 13h2v2H8zM13 13h2v2h-2z" fill="#FDCF34"/>
  </Svg>
);

interface Props {
  onBack: () => void;
}

const FILTERS = [
  { label: 'Toutes',      value: null },
  { label: 'En attente',  value: 'en_attente' },
  { label: 'Confirmées',  value: 'confirme' },
  { label: 'Refusées',    value: 'refuse' },
] as const;

export default function GerantRdvBeautyScreen({ onBack }: Props) {
  const [rdvs, setRdvs]           = useState<BeautyRdvGerant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatut, setFilter] = useState<string | null>(null);

  const [modalRdv, setModalRdv]       = useState<BeautyRdvGerant | null>(null);
  const [message, setMessage]         = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getBeautyRdvGerant(filterStatut ?? undefined);
      setRdvs(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [filterStatut]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: 'confirmer' | 'refuser') => {
    if (!modalRdv) return;
    setSubmitting(true);
    try {
      await processBeautyAppointment({
        appointmentId: modalRdv.id,
        action,
        messageGerant: message.trim() || undefined,
      });
      setModalRdv(null);
      setMessage('');
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mes rendez-vous</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[s.filterChip, filterStatut === f.value && s.filterChipOn]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterTxt, filterStatut === f.value && s.filterTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingBox}><ActivityIndicator color={r.couleur.or} size="large" /></View>
      ) : rdvs.length === 0 ? (
        <View style={s.emptyBox}>
          <IcoCalendar />
          <Text style={s.emptyTxt}>Aucun rendez-vous</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={r.couleur.or} />
          }
        >
          {rdvs.map(rdv => {
            const couleur = STATUT_COLOR_BEAUTY[rdv.statut] ?? r.couleur.gris;
            return (
              <TouchableOpacity
                key={rdv.id}
                style={s.card}
                onPress={() => { setModalRdv(rdv); setMessage(''); }}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardDate}>
                      {formatDate(rdv.date_rdv)} · {rdv.heure_debut}
                      {rdv.heure_fin ? ` – ${rdv.heure_fin}` : ''}
                    </Text>
                    <Text style={s.cardNom}>{rdv.client_nom}</Text>
                    {rdv.client_tel && <Text style={s.cardTel}>{rdv.client_tel}</Text>}
                  </View>
                  <View style={[s.statutBadge, { borderColor: couleur }]}>
                    <Text style={[s.statutTxt, { color: couleur }]}>
                      {STATUT_LABEL_BEAUTY[rdv.statut] ?? rdv.statut}
                    </Text>
                  </View>
                </View>
                {rdv.prestation_nom && (
                  <Text style={s.cardPrestation}>{rdv.prestation_nom}</Text>
                )}
                {rdv.note_client && (
                  <Text style={s.cardNote}>« {rdv.note_client} »</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}

      {/* Modal détail + action */}
      <Modal
        visible={modalRdv != null}
        transparent
        animationType="slide"
        onRequestClose={() => setModalRdv(null)}
      >
        <Pressable style={s.overlay} onPress={() => setModalRdv(null)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            {modalRdv && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.sheetTitle}>Détail du rendez-vous</Text>
                <View style={s.sheetDivider} />

                <ModalRow label="Date"       value={`${formatDate(modalRdv.date_rdv)} · ${modalRdv.heure_debut}${modalRdv.heure_fin ? ` – ${modalRdv.heure_fin}` : ''}`} />
                <ModalRow label="Client"     value={modalRdv.client_nom} />
                {modalRdv.client_tel && <ModalRow label="Téléphone" value={modalRdv.client_tel} />}
                {modalRdv.prestation_nom && <ModalRow label="Prestation" value={modalRdv.prestation_nom} />}
                {modalRdv.note_client    && <ModalRow label="Message"    value={modalRdv.note_client} />}

                {modalRdv.statut === 'en_attente' && (
                  <>
                    <View style={s.sheetDivider} />
                    <Text style={s.sheetSectionTxt}>Votre message (optionnel)</Text>
                    <TextInput
                      style={s.messageInput}
                      placeholder="Ex : Confirmé ! À bientôt dans notre salon…"
                      placeholderTextColor={r.couleur.gris}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      maxLength={500}
                    />
                    <View style={s.actionsRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, s.btnRefuser]}
                        onPress={() => handleAction('refuser')}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        {submitting
                          ? <ActivityIndicator color="#E55C5C" size="small" />
                          : <Text style={s.btnRefuserTxt}>Refuser</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, s.btnAccepter]}
                        onPress={() => handleAction('confirmer')}
                        disabled={submitting}
                        activeOpacity={0.85}
                      >
                        {submitting
                          ? <ActivityIndicator color={r.couleur.encre} />
                          : <Text style={s.btnAccepterTxt}>Confirmer</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {modalRdv.message_gerant && (
                  <View style={s.msgGerantBox}>
                    <Text style={s.sheetSectionTxt}>Votre message envoyé</Text>
                    <Text style={s.msgGerantTxt}>{modalRdv.message_gerant}</Text>
                  </View>
                )}

                <TouchableOpacity style={s.closeSheetBtn} onPress={() => setModalRdv(null)} activeOpacity={0.8}>
                  <Text style={s.closeSheetTxt}>Fermer</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.modalRow}>
      <Text style={s.modalKey}>{label}</Text>
      <Text style={s.modalVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: r.couleur.encre },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: r.couleur.filet,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: r.couleur.velours, borderWidth: 1, borderColor: r.couleur.filet,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14, textAlign: 'center' },

  filterRow: { paddingVertical: 10, maxHeight: 52 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours, marginRight: 8,
  },
  filterChipOn: { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  filterTxt:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12 },
  filterTxtOn:  { color: r.couleur.or },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt:   { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 14 },

  content: { padding: 16 },

  card: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1, borderColor: r.couleur.filet,
    borderRadius: 10, padding: 14, marginBottom: 10, gap: 5,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardDate: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 13 },
  cardNom:  { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 12, marginTop: 2 },
  cardTel:  { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 11 },
  cardPrestation: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12 },
  cardNote: { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 11, fontStyle: 'italic' },
  statutBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statutTxt:   { fontFamily: r.police.util, fontSize: 10 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: r.couleur.velours,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: r.couleur.filet,
    padding: 20, maxHeight: '88%',
  },
  sheetTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15, marginBottom: 12 },
  sheetDivider: { height: 1, backgroundColor: r.couleur.filetFin, marginVertical: 10 },
  sheetSectionTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },

  modalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  modalKey: { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12, flex: 1 },
  modalVal: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, flex: 2, textAlign: 'right' },

  messageInput: {
    borderWidth: 1, borderColor: r.couleur.filet, borderRadius: 8,
    padding: 12, color: r.couleur.ivoire, fontFamily: r.police.util,
    fontSize: 13, minHeight: 80, textAlignVertical: 'top', marginBottom: 14,
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn:  { flex: 1, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnRefuser: { borderColor: '#E55C5C', backgroundColor: 'rgba(229,92,92,0.10)' },
  btnRefuserTxt: { color: '#E55C5C', fontFamily: r.police.util, fontSize: 13 },
  btnAccepter: { borderColor: 'transparent', backgroundColor: r.couleur.orLassi },
  btnAccepterTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 14 },

  msgGerantBox: { marginTop: 8 },
  msgGerantTxt: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, lineHeight: 18, marginTop: 4 },

  closeSheetBtn: {
    height: 46, borderRadius: 8, borderWidth: 1, borderColor: r.couleur.filet,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  closeSheetTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13 },
});
