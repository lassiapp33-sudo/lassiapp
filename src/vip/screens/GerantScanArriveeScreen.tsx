import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { validateTableArrival } from '../../services/tableReservations';
import { getErrorMessage } from '../../utils/errorUtils';
import QRScannerCamera from '../../components/terrain/QRScannerCamera';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={r.couleur.vert} />
    <Path d="M8 12l3 3 5-6" stroke={r.couleur.vert} />
  </Svg>
);

const IcoX = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke="#E55C5C" />
    <Path d="M15 9l-6 6M9 9l6 6" stroke="#E55C5C" />
  </Svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanResult =
  | { type: 'success'; nbPersonnes: number; acompteADeduire: number; motif?: string; message?: string }
  | { type: 'error'; message: string }
  | null;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function GerantScanArriveeScreen({ onBack }: Props) {
  const [code, setCode]             = useState('');
  const [verifying, setVerifying]   = useState(false);
  const [result, setResult]         = useState<ScanResult>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const verify = async (cleaned: string) => {
    if (!cleaned || cleaned.length < 4) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await validateTableArrival(cleaned);
      if (res.success) {
        setResult({
          type: 'success',
          nbPersonnes:     res.nbPersonnes    ?? 0,
          acompteADeduire: res.acompteADeduire ?? 3000,
          motif:           res.motif,
          message:         res.message,
        });
      } else {
        setResult({ type: 'error', message: 'Code invalide ou réservation non confirmée.' });
      }
    } catch (err) {
      setResult({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = () => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) { Alert.alert('Saisir un code'); return; }
    verify(cleaned);
  };

  const handleQRScan = (scanned: string) => {
    setCameraOpen(false);
    setCode(scanned.toUpperCase());
    verify(scanned.toUpperCase());
  };

  const reset = () => { setResult(null); setCode(''); };

  if (cameraOpen) {
    return (
      <QRScannerCamera
        visible={cameraOpen}
        onScan={handleQRScan}
        onClose={() => setCameraOpen(false)}
      />
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Validation arrivée</Text>
      </View>

      <View style={s.body}>
        {result == null && !verifying && (
          <>
            <Text style={s.instructions}>
              Scannez ou saisissez le code du ticket client pour valider son arrivée.
            </Text>

            {/* Saisie manuelle */}
            <TextInput
              style={s.input}
              placeholder="Ex : RESA-3A7F29"
              placeholderTextColor={r.couleur.gris}
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleManualVerify}
            />

            <TouchableOpacity style={s.btnVerif} onPress={handleManualVerify} activeOpacity={0.85}>
              <Text style={s.btnVerifTxt}>Valider le code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnScan} onPress={() => setCameraOpen(true)} activeOpacity={0.85}>
              <Text style={s.btnScanTxt}>Ouvrir le scanner</Text>
            </TouchableOpacity>
          </>
        )}

        {verifying && (
          <ActivityIndicator color={r.couleur.or} size="large" />
        )}

        {result?.type === 'success' && (
          <View style={s.resultBox}>
            <IcoCheck />
            <Text style={s.successTitle}>Client validé</Text>
            <Text style={s.successSub}>{result.nbPersonnes} personne{result.nbPersonnes > 1 ? 's' : ''}</Text>

            {result.motif && <Text style={s.successMotif}>{result.motif}</Text>}

            <View style={s.acompteBox}>
              <Text style={s.acompteLabel}>N'oubliez pas de déduire</Text>
              <Text style={s.acompteVal}>{result.acompteADeduire.toLocaleString('fr-FR')} FCFA</Text>
              <Text style={s.acompteLabel}>de la note finale</Text>
            </View>

            <TouchableOpacity style={s.btnReset} onPress={reset} activeOpacity={0.8}>
              <Text style={s.btnResetTxt}>Scanner un autre ticket</Text>
            </TouchableOpacity>
          </View>
        )}

        {result?.type === 'error' && (
          <View style={s.resultBox}>
            <IcoX />
            <Text style={s.errorTitle}>Code invalide</Text>
            <Text style={s.errorMsg}>{result.message}</Text>

            <TouchableOpacity style={s.btnReset} onPress={reset} activeOpacity={0.8}>
              <Text style={s.btnResetTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: r.couleur.encre },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
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
  headerTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15 },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center', gap: 16 },

  instructions: {
    color: r.couleur.gris,
    fontFamily: r.police.util,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },

  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 15,
    backgroundColor: r.couleur.velours,
    textAlign: 'center',
    letterSpacing: 3,
  },

  btnVerif: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnVerifTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 15 },

  btnScan: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnScanTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 14 },

  resultBox: { alignItems: 'center', gap: 12, width: '100%' },

  successTitle: { color: r.couleur.vert,   fontFamily: r.police.titre, fontSize: 22 },
  successSub:   { color: r.couleur.ivoire, fontFamily: r.police.util,  fontSize: 15 },
  successMotif: { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 13 },

  acompteBox: {
    alignItems: 'center',
    backgroundColor: `${r.couleur.or}12`,
    borderWidth: 1,
    borderColor: r.couleur.or,
    borderRadius: 10,
    padding: 20,
    width: '100%',
    gap: 4,
  },
  acompteLabel: { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 12 },
  acompteVal:   { color: r.couleur.orLassi, fontFamily: r.police.titre, fontSize: 28 },

  errorTitle: { color: '#E55C5C', fontFamily: r.police.titre, fontSize: 20 },
  errorMsg:   { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13, textAlign: 'center' },

  btnReset: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnResetTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13 },
});
