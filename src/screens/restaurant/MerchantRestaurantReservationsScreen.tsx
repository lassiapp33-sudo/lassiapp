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
  Linking,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import {
  getPrestatairReservationsStd,
  processStdTableReservation,
} from '../../services/tableReservations';
import { getErrorMessage } from '../../utils/errorUtils';

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

const FILTERS = [
  { id: null,               label: 'Toutes' },
  { id: 'en_attente',       label: 'En attente' },
  { id: 'acceptee',         label: 'Acceptées' },
  { id: 'refusee',          label: 'Refusées' },
];

interface Props {
  onBack: () => void;
}

export default function MerchantRestaurantReservationsScreen({ onBack }: Props) {
  const [reservations, setReservations] = useState<Resa[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filterStatut, setFilterStatut] = useState<string | null>(null);

  const [selectedResa, setSelectedResa] = useState<Resa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageGerant, setMessageGerant] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getPrestatairReservationsStd(filterStatut ?? undefined);
      setReservations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatut]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: 'accepter' | 'refuser') => {
    if (!selectedResa) return;
    setActionLoading(true);
    try {
      await processStdTableReservation({
        reservationId: selectedResa.id,
        action,
        messageGerant: messageGerant.trim() || undefined,
      });
      setSelectedResa(null);
      setMessageGerant('');
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
            stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réservations de table</Text>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.id)}
            style={[s.filterChip, filterStatut === f.id && s.filterChipOn]}
            onPress={() => setFilterStatut(f.id)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterChipTxt, filterStatut === f.id && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {reservations.length === 0 ? (
            <View style={s.emptyBox}>
              <Svg width={48} height={48} viewBox="0 0 24 24">
                <Rect x="4" y="4" width="16" height="18" rx="2" stroke={colors.muted} strokeWidth={1.5} fill="none"/>
                <Path d="M8 10h8M8 13.5h8M8 17h5" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round"/>
              </Svg>
              <Text style={s.emptyTxt}>Aucune réservation</Text>
            </View>
          ) : (
            reservations.map(resa => {
              const statusColor = STATUT_COLOR[resa.statut] ?? colors.muted;
              return (
                <TouchableOpacity
                  key={resa.id}
                  style={s.card}
                  onPress={() => { setSelectedResa(resa); setMessageGerant(''); }}
                  activeOpacity={0.8}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardClient}>{resa.client_nom || 'Client'}</Text>
                      <Text style={s.cardMeta}>
                        {formatDateShort(resa.date_reservation)} · {resa.heure_debut?.slice(0, 5)} · {resa.nb_personnes} pers.
                      </Text>
                      {resa.slot_label ? <Text style={s.cardMeta}>{resa.slot_label}</Text> : null}
                      {resa.space_nom  ? <Text style={s.cardMeta}>{resa.space_nom}</Text>  : null}
                    </View>
                    <View style={[s.statusBadge, { borderColor: statusColor }]}>
                      <Text style={[s.statusTxt, { color: statusColor }]}>
                        {STATUT_LABEL[resa.statut] ?? resa.statut}
                      </Text>
                    </View>
                  </View>
                  {resa.motif ? <Text style={s.motifTxt}>Occasion : {resa.motif}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}

      {/* Modal de traitement */}
      <Modal
        visible={!!selectedResa}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedResa(null)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setSelectedResa(null)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            {selectedResa && (
              <>
                <Text style={s.modalTitle}>
                  {selectedResa.client_nom || 'Client'} — {formatDateShort(selectedResa.date_reservation)} · {selectedResa.heure_debut?.slice(0, 5)}
                </Text>
                <Text style={s.modalMeta}>
                  {selectedResa.nb_personnes} personne{selectedResa.nb_personnes > 1 ? 's' : ''}
                  {selectedResa.slot_label  ? ` · ${selectedResa.slot_label}` : ''}
                  {selectedResa.space_nom   ? ` · ${selectedResa.space_nom}`  : ''}
                </Text>
                {selectedResa.motif ? <Text style={s.modalMeta}>Occasion : {selectedResa.motif}</Text> : null}
                {selectedResa.options_speciales?.length > 0 && (
                  <Text style={s.modalMeta}>Options : {selectedResa.options_speciales.join(', ')}</Text>
                )}

                {selectedResa.client_tel ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedResa.client_tel}`)} style={s.telBtn}>
                    <Text style={s.telBtnTxt}>Appeler le client : {selectedResa.client_tel}</Text>
                  </TouchableOpacity>
                ) : null}

                {selectedResa.statut === 'en_attente' && (
                  <>
                    <Text style={s.modalLabel}>Message optionnel</Text>
                    <TextInput
                      style={s.textInput}
                      placeholder="Message pour le client (optionnel)"
                      placeholderTextColor={colors.muted}
                      value={messageGerant}
                      onChangeText={setMessageGerant}
                      maxLength={500}
                      multiline
                    />
                    <View style={s.actionsRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, s.acceptBtn, actionLoading && { opacity: 0.6 }]}
                        onPress={() => handleAction('accepter')}
                        disabled={actionLoading}
                        activeOpacity={0.85}
                      >
                        {actionLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={s.actionBtnTxt}>Accepter</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, s.refuseBtn, actionLoading && { opacity: 0.6 }]}
                        onPress={() => handleAction('refuser')}
                        disabled={actionLoading}
                        activeOpacity={0.85}
                      >
                        {actionLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={s.actionBtnTxt}>Refuser</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selectedResa.statut !== 'en_attente' && (
                  <View style={[s.statusBadge, { borderColor: STATUT_COLOR[selectedResa.statut] ?? colors.muted, alignSelf: 'flex-start', marginTop: 8 }]}>
                    <Text style={[s.statusTxt, { color: STATUT_COLOR[selectedResa.statut] ?? colors.muted }]}>
                      {STATUT_LABEL[selectedResa.statut] ?? selectedResa.statut}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  filterScroll:  { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipOn:    { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  filterChipTxt:   { color: colors.muted,  fontFamily: fonts.ui, fontSize: 12 },
  filterChipTxtOn: { color: colors.accent },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 14 },

  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, padding: 14, marginBottom: 10, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardClient: { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 2 },
  cardMeta:   { color: colors.muted, fontFamily: fonts.ui,    fontSize: 12 },
  motifTxt:   { color: colors.muted, fontFamily: fonts.ui,    fontSize: 12, fontStyle: 'italic' },

  statusBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusTxt: { fontFamily: fonts.ui, fontSize: 11 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, gap: 10,
  },
  modalTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  modalMeta:  { color: colors.muted, fontFamily: fonts.ui,    fontSize: 13 },
  modalLabel: { color: colors.accent, fontFamily: fonts.ui,   fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 },

  telBtn: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center',
  },
  telBtnTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, color: colors.white, fontFamily: fonts.ui, fontSize: 13,
    backgroundColor: colors.bg, minHeight: 70, textAlignVertical: 'top',
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1, height: 48, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn:    { backgroundColor: '#27AE60' },
  refuseBtn:    { backgroundColor: '#E55C5C' },
  actionBtnTxt: { color: '#fff', fontFamily: fonts.title, fontSize: 14 },
});
