import React, { useRef, useState } from 'react';
import {
  Modal, View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { createReservation, verifyTerrainPayment, calculerPrixAvecMarge } from '../../services/terrains';
import { createPayment } from '../../services/payment';
import { Terrain, ReservationTerrain } from '../../types/terrain';
import useAuthStore from '../../store/authStore';
import logger from '../../utils/logger';

interface Props {
  visible: boolean;
  terrain: Terrain;
  date: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  onClose: () => void;
  onSuccess: (reservation: ReservationTerrain) => void;
}

type Stage = 'confirm' | 'waiting';
type MoyenPaiement = 'wave' | 'orange_money';

// Logos partenaires intégrés tels quels — ne pas modifier les images
const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO = require('../../../assets/om.png');

const Row = ({ label, value, gold }: { label: string; value: string; gold?: boolean }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, gold && styles.rowGold]}>{value}</Text>
  </View>
);

export default function ReservationModal({
  visible, terrain, date, heureDebut, heureFin,
  dureeHeures, onClose, onSuccess,
}: Props) {
  const user = useAuthStore(s => s.user);
  const [stage, setStage] = useState<Stage>('confirm');
  const [paiement, setPaiement] = useState<MoyenPaiement>('wave');
  const [loading, setLoading] = useState(false);
  const referenceRef = useRef('');

  const prixTotal = calculerPrixAvecMarge(terrain.prix_horaire * dureeHeures);

  const handleClose = () => {
    setStage('confirm');
    referenceRef.current = '';
    onClose();
  };

  // ── Etape 1 : ouvrir l'URL de paiement ───────────────────────────────────────
  const handlePayer = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await createPayment({
        ticketId: `${terrain.id}_${date}_${heureDebut}`,
        amount: prixTotal,
        method: paiement === 'wave' ? 'wave' : 'om',
        merchantName: terrain.nom,
      });
      referenceRef.current = session.reference;
      await Linking.openURL(session.paymentUrl);
      setStage('waiting');
    } catch (err) {
      logger.warn('[ReservationModal] payer:', err);
      const msg = err instanceof Error ? err.message : 'Impossible de lancer le paiement. Reessaie.';
      Alert.alert('Paiement', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Etape 2 : verifier + creer la reservation ─────────────────────────────────
  const handleVerifier = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const paid = await verifyTerrainPayment({
        reference: referenceRef.current,
        method: paiement,
      });

      if (!paid) {
        Alert.alert(
          'Paiement non confirme',
          'Le paiement nest pas encore confirme. Attends quelques secondes et reessaie.',
        );
        return;
      }

      const reservation = await createReservation({
        clientId: user.id,
        terrainId: terrain.id,
        prestataireId: terrain.prestataire_id,
        date,
        heureDebut,
        heureFin,
        dureeHeures,
        prixTotal,
        moyenPaiement: paiement,
        paiementRef: referenceRef.current,
      });

      onSuccess(reservation);
    } catch (err: unknown) {
      logger.warn('[ReservationModal] verifier:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('no_overlap') || msg.includes('exclusion') || msg.includes('EXCLUDE')) {
        Alert.alert('Creneau pris', 'Ce creneau vient detre reserve. Choisis-en un autre.');
        handleClose();
      } else {
        Alert.alert('Erreur', 'Impossible de confirmer la reservation. Reessaie.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {stage === 'confirm' ? (
            <>
              <Text style={styles.title}>Confirmer la reservation</Text>

              <View style={styles.recap}>
                <Row label="Terrain" value={terrain.nom} />
                <Row label="Date" value={date} />
                <Row label="Creneau" value={`${heureDebut} → ${heureFin}`} />
                <Row label="Duree" value={`${dureeHeures}h`} />
                <Row
                  label="Prix total"
                  value={`${prixTotal.toLocaleString()} FCFA`}
                  gold
                />
              </View>

              <Text style={styles.warning}>
                Aucune annulation possible apres paiement.{'\n'}
                Tout litige est a regler directement avec le prestataire.
              </Text>

              <View style={styles.paiRow}>
                {(['wave', 'orange_money'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.paiBtn, paiement === m && styles.paiBtnActive]}
                    onPress={() => setPaiement(m)}
                  >
                    <Image
                      source={m === 'wave' ? WAVE_LOGO : OM_LOGO}
                      style={styles.paiLogo}
                      resizeMode="cover"
                    />
                    <Text style={styles.paiBtnText}>
                      {m === 'wave' ? 'Wave' : 'Orange Money'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handlePayer}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#14152A" />
                  : <Text style={styles.btnText}>Payer {prixTotal.toLocaleString()} FCFA</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClose} style={styles.cancel}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Paiement en cours</Text>
              <Text style={styles.waitBody}>
                Complete le paiement de{' '}
                <Text style={styles.waitAmount}>{prixTotal.toLocaleString()} FCFA</Text>
                {' '}dans {paiement === 'wave' ? 'Wave' : 'Orange Money'}, puis reviens ici.
              </Text>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleVerifier}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#14152A" />
                  : <Text style={styles.btnText}>J ai paye — Verifier</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStage('confirm'); referenceRef.current = ''; }}
                style={styles.cancel}
              >
                <Text style={styles.cancelText}>Annuler et revenir</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1E2040',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 26,
  },
  title: {
    color: '#FDCF34', fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18, marginBottom: 18, textAlign: 'center',
  },
  recap: {
    backgroundColor: '#14152A', borderRadius: 16,
    padding: 16, gap: 10, marginBottom: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#9A9EC4', fontSize: 14 },
  rowValue: { color: '#EDEEF7', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  rowGold: { color: '#FDCF34', fontFamily: 'PlusJakartaSans_700Bold' },
  warning: {
    color: '#E07A7A', fontSize: 12,
    textAlign: 'center', marginBottom: 16, lineHeight: 18,
  },
  paiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  paiBtn: {
    flex: 1, flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#2A2C52', alignItems: 'center', justifyContent: 'center',
  },
  paiBtnActive: { borderColor: '#FDCF34', backgroundColor: 'rgba(253,207,52,.1)' },
  paiLogo: { width: 24, height: 24, borderRadius: 6 },
  paiBtnText: { color: '#EDEEF7', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  btn: {
    backgroundColor: '#FDCF34', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#14152A', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#9A9EC4', fontSize: 14 },
  waitBody: {
    color: '#9A9EC4', fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  waitAmount: { color: '#FDCF34', fontFamily: 'PlusJakartaSans_700Bold' },
});
