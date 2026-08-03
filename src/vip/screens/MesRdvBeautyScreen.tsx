import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { BeautyAppointment, STATUT_LABEL_BEAUTY, STATUT_COLOR_BEAUTY } from '../../types/beautyAppointment';
import { getMyBeautyAppointments, cancelMyBeautyAppointment } from '../../services/beautyAppointments';

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatDateRdv(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
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

export default function MesRdvBeautyScreen({ onBack }: Props) {
  const [rdvs, setRdvs]         = useState<BeautyAppointment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [annulant, setAnnulant] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMyBeautyAppointments();
      setRdvs(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAnnuler = (rdv: BeautyAppointment) => {
    Alert.alert(
      'Annuler le rendez-vous',
      `Annuler votre RDV du ${formatDateRdv(rdv.date_rdv)} à ${rdv.heure_debut} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setAnnulant(rdv.id);
            try {
              await cancelMyBeautyAppointment(rdv.id);
              load();
            } catch {
              Alert.alert('Erreur', 'Impossible d\'annuler ce rendez-vous.');
            } finally {
              setAnnulant(null);
            }
          },
        },
      ],
    );
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

      {loading ? (
        <View style={s.centreBox}><ActivityIndicator color={r.couleur.or} size="large" /></View>
      ) : rdvs.length === 0 ? (
        <View style={s.centreBox}>
          <IcoCalendar />
          <Text style={s.emptyTxt}>Aucun rendez-vous</Text>
          <Text style={s.emptyDesc}>Vos prises de rendez-vous{'\n'}dans les salons 5 Étoiles apparaîtront ici.</Text>
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
            const peutAnnuler = rdv.statut === 'en_attente';
            return (
              <View key={rdv.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardDate}>
                      {formatDateRdv(rdv.date_rdv)} · {rdv.heure_debut.slice(0, 5)}
                      {rdv.heure_fin ? ` – ${rdv.heure_fin.slice(0, 5)}` : ''}
                    </Text>
                    {rdv.prestation_nom && (
                      <Text style={s.cardPrestation}>{rdv.prestation_nom}</Text>
                    )}
                  </View>
                  <View style={[s.statutBadge, { borderColor: couleur }]}>
                    <Text style={[s.statutTxt, { color: couleur }]}>
                      {STATUT_LABEL_BEAUTY[rdv.statut] ?? rdv.statut}
                    </Text>
                  </View>
                </View>

                {rdv.note_client && (
                  <Text style={s.cardNote}>« {rdv.note_client} »</Text>
                )}

                {rdv.message_gerant && (
                  <View style={s.messageGerantBox}>
                    <Text style={s.messageGerantLabel}>Message du salon :</Text>
                    <Text style={s.messageGerantTxt}>{rdv.message_gerant}</Text>
                  </View>
                )}

                {peutAnnuler && (
                  annulant === rdv.id ? (
                    <ActivityIndicator color={r.couleur.gris} size="small" style={{ marginTop: 10 }} />
                  ) : (
                    <TouchableOpacity style={s.btnAnnuler} onPress={() => handleAnnuler(rdv)} activeOpacity={0.8}>
                      <Text style={s.btnAnnulerTxt}>Annuler ce RDV</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          })}
          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}
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
  headerTitle: { flex: 1, color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15, textAlign: 'center' },

  centreBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt:  { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15 },
  emptyDesc: { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 13, textAlign: 'center', lineHeight: 20 },

  content: { padding: 16 },

  card: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1, borderColor: r.couleur.filet,
    borderRadius: 10, padding: 14, marginBottom: 10, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardDate: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 13 },
  cardPrestation: { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 12, marginTop: 2 },
  statutBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statutTxt:   { fontFamily: r.police.util, fontSize: 10 },

  cardNote: {
    color: r.couleur.gris, fontFamily: r.police.util,
    fontSize: 12, fontStyle: 'italic', marginTop: 2,
  },

  messageGerantBox: {
    borderTopWidth: 1, borderTopColor: r.couleur.filetFin,
    paddingTop: 8, marginTop: 4,
  },
  messageGerantLabel: { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  messageGerantTxt:   { color: r.couleur.ivoire,  fontFamily: r.police.util, fontSize: 12, lineHeight: 18 },

  btnAnnuler: {
    marginTop: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E55C5C',
    borderRadius: 6, alignItems: 'center',
  },
  btnAnnulerTxt: { color: '#E55C5C', fontFamily: r.police.util, fontSize: 12 },
});
