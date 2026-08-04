import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import {
  getGerantReservations,
  processTableReservation,
} from '../../services/tableReservations';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Types locaux ─────────────────────────────────────────────────────────────

type Resa = {
  id: string;
  date_reservation: string;
  heure_debut: string;
  nb_personnes: number;
  motif: string;
  options_speciales: string[];
  statut: string;
  acompte_montant: number;
  created_at: string;
  space_nom: string;
  slot_label: string;
  client_nom: string;
  client_tel: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoClipboard = () => (
  <Svg width={56} height={56} viewBox="0 0 24 24">
    <Rect x="4" y="4" width="16" height="18" rx="2" stroke="#FDCF34" strokeWidth={1.5} fill="#FDCF3440"/>
    <Path d="M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="#FDCF34" strokeWidth={1.2} fill="none"/>
    <Path d="M8 10h8M8 13.5h8M8 17h5" stroke="#FDCF34" strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const STATUT_COLOR: Record<string, string> = {
  en_attente:           '#F5C842',
  acceptee:             '#7FCF9C',
  alternative_proposee: '#C9A227',
  refusee:              '#E55C5C',
  arrivee:              '#7FCF9C',
  terminee:             '#8E93AB',
  annulee:              '#8E93AB',
};

const STATUT_LABEL: Record<string, string> = {
  en_attente:           'En attente',
  acceptee:             'Acceptée',
  alternative_proposee: 'Alternative',
  refusee:              'Refusée',
  arrivee:              'Arrivée',
  terminee:             'Terminée',
  annulee:              'Annulée',
};

const OPTION_LABEL: Record<string, string> = {
  bougie:             'Bougie',
  emplacement_intime: 'Intime',
  chaise_haute:       'Chaise haute',
  decoration_table:   'Décoration',
};

const MOTIF_LABEL: Record<string, string> = {
  anniversaire:  'Anniversaire',
  mariage:       'Mariage',
  fiancailles:   'Fiançailles',
  fete_surprise: 'Fête surprise',
  affaires:      'Affaires',
  romantique:    'Romantique',
  autre:         'Autre',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onScanQR: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function GerantReservationsTableScreen({ onBack, onScanQR }: Props) {
  const [reservations, setReservations] = useState<Resa[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filterStatut, setFilterStatut] = useState<string | null>(null);

  // Modal action
  const [modalResa, setModalResa]         = useState<Resa | null>(null);
  const [messageGerant, setMessageGerant] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [showAltFields, setShowAltFields] = useState(false);
  const [altDate, setAltDate]             = useState('');
  const [altHeure, setAltHeure]           = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getGerantReservations(filterStatut ?? undefined);
      setReservations(data as unknown as Resa[]);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatut]);

  useEffect(() => { load(); }, [load]);

  const resetModal = () => {
    setModalResa(null);
    setMessageGerant('');
    setShowAltFields(false);
    setAltDate('');
    setAltHeure('');
  };

  // L'action est passée directement en paramètre pour éviter le timing async de setState
  const handleAction = async (actionParam: 'accepter' | 'refuser' | 'proposer_alternative') => {
    if (!modalResa) return;

    if (actionParam === 'proposer_alternative' && !showAltFields) {
      setShowAltFields(true);
      return;
    }

    if (actionParam === 'proposer_alternative') {
      const dateOk   = /^\d{4}-\d{2}-\d{2}$/.test(altDate.trim());
      const heureOk  = /^\d{2}:\d{2}$/.test(altHeure.trim());
      if (!dateOk || !heureOk) {
        Alert.alert('Champs requis', 'Saisir une date (AAAA-MM-JJ) et une heure (HH:MM) pour l\'alternative.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await processTableReservation({
        reservationId:  modalResa.id,
        action:         actionParam,
        messageGerant:  messageGerant.trim() || undefined,
        altDate:        actionParam === 'proposer_alternative' ? altDate.trim() : undefined,
        altHeureDebut:  actionParam === 'proposer_alternative' ? altHeure.trim() : undefined,
        altMessage:     actionParam === 'proposer_alternative' ? (messageGerant.trim() || undefined) : undefined,
      });
      resetModal();
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const FILTERS = [
    { label: 'Toutes',     value: null },
    { label: 'En attente', value: 'en_attente' },
    { label: 'Acceptées',  value: 'acceptee' },
    { label: 'Arrivée',    value: 'arrivee' },
    { label: 'Refusées',   value: 'refusee' },
  ] as const;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réservations de table</Text>
        <TouchableOpacity style={s.scanBtn} onPress={onScanQR} activeOpacity={0.8}>
          <Text style={s.scanBtnTxt}>Scanner</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[s.filterChip, filterStatut === f.value && s.filterChipOn]}
            onPress={() => setFilterStatut(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterTxt, filterStatut === f.value && s.filterTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={r.couleur.or} size="large" />
        </View>
      ) : reservations.length === 0 ? (
        <View style={s.emptyBox}>
          <IcoClipboard />
          <Text style={s.emptyTxt}>Aucune réservation</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={r.couleur.or} />
          }
        >
          {reservations.map(resa => {
            const statutColor = STATUT_COLOR[resa.statut] ?? r.couleur.gris;
            return (
              <TouchableOpacity
                key={resa.id}
                style={s.card}
                onPress={() => { setModalResa(resa); setMessageGerant(''); setShowAltFields(false); setAltDate(''); setAltHeure(''); }}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View>
                    <Text style={s.cardDate}>{formatDateShort(resa.date_reservation)} · {resa.heure_debut.slice(0, 5)}</Text>
                    <Text style={s.cardNom}>{resa.client_nom || 'Client'}</Text>
                    {resa.client_tel && <Text style={s.cardTel}>{resa.client_tel}</Text>}
                  </View>
                  <View style={[s.statutBadge, { borderColor: statutColor }]}>
                    <Text style={[s.statutTxt, { color: statutColor }]}>{STATUT_LABEL[resa.statut] ?? resa.statut}</Text>
                  </View>
                </View>
                <View style={s.cardRow}>
                  <Text style={s.cardKey}>Convives</Text>
                  <Text style={s.cardVal}>{resa.nb_personnes}</Text>
                </View>
                {resa.motif && (
                  <Text style={s.cardMotif}>{MOTIF_LABEL[resa.motif] ?? resa.motif}</Text>
                )}
                {resa.options_speciales?.length > 0 && (
                  <Text style={s.cardOptions}>{resa.options_speciales.map(o => OPTION_LABEL[o] ?? o).join(' · ')}</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Modal détail + action */}
      <Modal
        visible={modalResa != null}
        transparent
        animationType="slide"
        onRequestClose={() => setModalResa(null)}
      >
        <Pressable style={s.overlay} onPress={resetModal}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            {modalResa && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.sheetTitle}>Demande de réservation</Text>
                <View style={s.sheetDivider} />

                <ModalRow label="Date"      value={`${formatDateShort(modalResa.date_reservation)} · ${modalResa.heure_debut.slice(0, 5)}`} />
                <ModalRow label="Client"    value={modalResa.client_nom || '—'} />
                <ModalRow label="Téléphone" value={modalResa.client_tel || '—'} />
                <ModalRow label="Convives"  value={`${modalResa.nb_personnes} personne${modalResa.nb_personnes > 1 ? 's' : ''}`} />
                {modalResa.motif    && <ModalRow label="Occasion" value={MOTIF_LABEL[modalResa.motif] ?? modalResa.motif} />}
                {modalResa.slot_label && <ModalRow label="Créneau" value={modalResa.slot_label} />}
                {modalResa.space_nom  && <ModalRow label="Espace"  value={modalResa.space_nom} />}
                {modalResa.options_speciales?.length > 0 && (
                  <ModalRow label="Options" value={modalResa.options_speciales.map(o => OPTION_LABEL[o] ?? o).join(', ')} />
                )}
                <ModalRow label="Acompte"   value={`${modalResa.acompte_montant} FCFA (à déduire sur place)`} />

                {modalResa.statut === 'en_attente' && (
                  <>
                    <View style={s.sheetDivider} />
                    <Text style={s.sheetSectionTxt}>Message (optionnel)</Text>
                    <TextInput
                      style={s.messageInput}
                      placeholder="Ex : Votre table vous attend avec plaisir…"
                      placeholderTextColor={r.couleur.gris}
                      value={messageGerant}
                      onChangeText={setMessageGerant}
                      multiline
                      maxLength={500}
                    />

                    {showAltFields && (
                      <>
                        <Text style={[s.sheetSectionTxt, { marginTop: 12 }]}>Proposition d'alternative</Text>
                        <TextInput
                          style={s.altInput}
                          placeholder="Date alternative (AAAA-MM-JJ)"
                          placeholderTextColor={r.couleur.gris}
                          value={altDate}
                          onChangeText={setAltDate}
                          keyboardType="numeric"
                          maxLength={10}
                        />
                        <TextInput
                          style={[s.altInput, { marginTop: 8 }]}
                          placeholder="Heure alternative (HH:MM)"
                          placeholderTextColor={r.couleur.gris}
                          value={altHeure}
                          onChangeText={setAltHeure}
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </>
                    )}

                    <View style={s.actionsRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, s.btnRefuser]}
                        onPress={() => handleAction('refuser')}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        <Text style={s.btnRefuserTxt}>Refuser</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, s.btnAlternative, showAltFields && s.btnAlternativeOn]}
                        onPress={() => handleAction('proposer_alternative')}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        <Text style={s.btnAlternativeTxt}>{showAltFields ? 'Envoyer' : 'Alternative'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, s.btnAccepter]}
                        onPress={() => handleAction('accepter')}
                        disabled={submitting}
                        activeOpacity={0.85}
                      >
                        {submitting
                          ? <ActivityIndicator color={r.couleur.encre} />
                          : <Text style={s.btnAccepterTxt}>Accepter</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <TouchableOpacity style={s.closeSheetBtn} onPress={resetModal} activeOpacity={0.8}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filet,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14, flex: 1 },
  scanBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}18`,
  },
  scanBtnTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },

  filterRow: { paddingVertical: 10, maxHeight: 52 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    marginRight: 8,
  },
  filterChipOn:  { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  filterTxt:     { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12 },
  filterTxtOn:   { color: r.couleur.or },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt:   { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 14 },

  content: { padding: 16 },

  card: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDate: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 13 },
  cardNom:  { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 12, marginTop: 2 },
  cardTel:  { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 11 },
  statutBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statutTxt:   { fontFamily: r.police.util, fontSize: 10 },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  cardKey:     { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11 },
  cardVal:     { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 11 },
  cardMotif:   { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 11 },
  cardOptions: { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 10, fontStyle: 'italic' },

  // Modal / sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: r.couleur.velours,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: r.couleur.filet,
    padding: 20,
    maxHeight: '88%',
  },
  sheetTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15, marginBottom: 12 },
  sheetDivider: { height: 1, backgroundColor: r.couleur.filetFin, marginVertical: 10 },
  sheetSectionTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },

  modalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  modalKey: { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12, flex: 1 },
  modalVal: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, flex: 2, textAlign: 'right' },

  messageInput: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 8,
    padding: 12,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },

  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionBtn:  { flex: 1, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnRefuser: { borderColor: '#E55C5C', backgroundColor: 'rgba(229,92,92,0.10)' },
  btnRefuserTxt: { color: '#E55C5C', fontFamily: r.police.util, fontSize: 12 },
  btnAlternative:   { borderColor: r.couleur.or, backgroundColor: 'transparent' },
  btnAlternativeOn: { backgroundColor: `${r.couleur.or}22` },
  btnAlternativeTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },

  altInput: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 13,
  },
  btnAccepter: { borderColor: 'transparent', backgroundColor: r.couleur.orLassi },
  btnAccepterTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 13 },

  closeSheetBtn: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeSheetTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13 },
});
