import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import {
  calculerPrixClient,
  calculerCommission,
  PAYMENT_CONFIG,
} from '../../config/payment';

interface Props {
  label?: string;
  onChangePrixBase: (prix: number) => void;
}

export default function PrixInput({ label = 'Votre prix (FCFA)', onChangePrixBase }: Props) {
  const [raw, setRaw] = useState('');
  const prixBase = parseInt(raw) || 0;
  const prixClient = calculerPrixClient(prixBase);
  const commission = calculerCommission(prixBase);

  const handleChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setRaw(clean);
    onChangePrixBase(parseInt(clean) || 0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={raw}
        onChangeText={handleChange}
        keyboardType="numeric"
        placeholder="Ex: 2000"
        placeholderTextColor="#9A9EC4"
        maxLength={7}
      />
      {prixBase > 0 && (
        <View style={styles.preview}>
          <Row label="Votre prix (vous recevez)" value={`${prixBase.toLocaleString()} FCFA`} />
          <Row
            label={`Commission LASSİ (${PAYMENT_CONFIG.COMMISSION_PERCENT_DISPLAY})`}
            value={`+ ${commission.toLocaleString()} FCFA`}
            muted
          />
          <Row
            label="Prix affiché au client"
            value={`${prixClient.toLocaleString()} FCFA`}
            gold
          />
        </View>
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
  container: { marginBottom: 20 },
  label: { color: '#EDEEF7', fontFamily: 'PoppinsSemiBold', fontSize: 15, marginBottom: 8 },
  input: {
    backgroundColor: '#1E2040',
    borderRadius: 14,
    padding: 16,
    color: '#EDEEF7',
    fontSize: 18,
    fontFamily: 'PoppinsSemiBold',
    borderWidth: 1.5,
    borderColor: '#2A2C52',
  },
  preview: {
    backgroundColor: '#14152A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: '#9A9EC4', fontSize: 13 },
  rowValue: { color: '#EDEEF7', fontSize: 13, fontFamily: 'PoppinsSemiBold' },
});
