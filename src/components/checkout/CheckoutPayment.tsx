import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {
  initierPaiement,
  verifierPaiement,
  calculerPrixClient,
  calculerCommission,
  PAYMENT_CONFIG,
  MoyenPaiement,
} from '../../services/paymentService';

interface Props {
  orderId: string;
  prestataireId: string;
  prixBase: number;
  onSuccess: () => void;
}

export default function CheckoutPayment({ orderId, prestataireId, prixBase, onSuccess }: Props) {
  const [moyen, setMoyen] = useState<MoyenPaiement>('wave');
  const [loading, setLoading] = useState(false);

  const prixClient = calculerPrixClient(prixBase);
  const commission = calculerCommission(prixBase);

  const handlePayer = async () => {
    setLoading(true);
    try {
      const result = await initierPaiement({ orderId, prestataireId, prixBase, moyenPaiement: moyen });
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Paiement impossible');
        return;
      }

      if (result.mode === 'simulation') {
        const verification = await verifierPaiement(result.paymentIntentId!);
        if (verification.confirmed) {
          Alert.alert('✅ Paiement simulé', 'Commande validée (mode démo)', [
            { text: 'OK', onPress: onSuccess },
          ]);
        }
        return;
      }

      if (result.redirectUrl) {
        await Linking.openURL(result.redirectUrl);
        // Vérification au retour via deep link : lassiapp://paiement/succes?pi=...
      }
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paiement</Text>

      <View style={styles.recap}>
        <Row label="Prix produit" value={`${prixBase.toLocaleString()} FCFA`} />
        <Row
          label={`Frais de service LASSİ (${PAYMENT_CONFIG.COMMISSION_PERCENT_DISPLAY})`}
          value={`${commission.toLocaleString()} FCFA`}
          muted
        />
        <View style={styles.divider} />
        <Row label="Total à payer" value={`${prixClient.toLocaleString()} FCFA`} gold />
      </View>

      <Text style={styles.sectionLabel}>Payer avec</Text>
      <View style={styles.moyenRow}>
        {PAYMENT_CONFIG.MOYENS_PAIEMENT.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.moyenBtn, moyen === m && styles.moyenBtnActive]}
            onPress={() => setMoyen(m)}
          >
            <Text style={styles.moyenIcon}>{m === 'wave' ? '🌊' : '🟠'}</Text>
            <Text style={[styles.moyenText, moyen === m && { color: '#14152A' }]}>
              {m === 'wave' ? 'Wave' : 'Orange Money'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.payBtn, loading && { opacity: 0.6 }]}
        onPress={handlePayer}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#14152A" />
        ) : (
          <Text style={styles.payBtnText}>
            Payer {prixClient.toLocaleString()} FCFA via{' '}
            {moyen === 'wave' ? 'Wave' : 'Orange Money'}
          </Text>
        )}
      </TouchableOpacity>

      {PAYMENT_CONFIG.MODE === 'simulation' && (
        <Text style={styles.simNote}>
          🔶 Mode démo — Le paiement est simulé. Branchement Wave/OM en cours.
        </Text>
      )}
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  gold?: boolean;
  muted?: boolean;
}

const Row = ({ label, value, gold, muted }: RowProps) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, muted && { color: '#6B6F9E' }]}>{label}</Text>
    <Text style={[styles.rowValue, gold && { color: '#FDCF34', fontFamily: 'PoppinsSemiBold' }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14152A', padding: 24 },
  title: {
    color: '#FDCF34',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 22,
    marginBottom: 20,
  },
  recap: {
    backgroundColor: '#1E2040',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
  divider: { height: 1, backgroundColor: '#2A2C52', marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#9A9EC4', fontSize: 14 },
  rowValue: { color: '#EDEEF7', fontSize: 14, fontFamily: 'PoppinsSemiBold' },
  sectionLabel: {
    color: '#EDEEF7',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 16,
    marginBottom: 12,
  },
  moyenRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  moyenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2A2C52',
    backgroundColor: '#1E2040',
  },
  moyenBtnActive: { backgroundColor: '#FDCF34', borderColor: '#FDCF34' },
  moyenIcon: { fontSize: 20 },
  moyenText: { color: '#EDEEF7', fontFamily: 'PoppinsSemiBold', fontSize: 14 },
  payBtn: {
    backgroundColor: '#FDCF34',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  payBtnText: { color: '#14152A', fontFamily: 'PoppinsSemiBold', fontSize: 16 },
  simNote: {
    color: '#FDCF34',
    textAlign: 'center',
    marginTop: 14,
    fontSize: 12,
    opacity: 0.7,
  },
});
