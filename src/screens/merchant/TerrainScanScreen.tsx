import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import useAuthStore from '../../store/authStore';
import * as terrainsService from '../../services/terrains';
import { getErrorMessage } from '../../utils/errorUtils';
import QRScannerCamera from '../../components/terrain/QRScannerCamera';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={60} height={60} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.success} />
    <Path d="M8 12l3 3 5-6" stroke={colors.success} />
  </Svg>
);

const IcoX = () => (
  <Svg width={60} height={60} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.danger} />
    <Path d="M15 9l-6 6M9 9l6 6" stroke={colors.danger} />
  </Svg>
);

const IcoScan = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={colors.bg} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={colors.bg} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={colors.bg} />
    <Path d="M14 14h2v2h-2zM18 14v2M14 18h2M18 18v2M20 20h-2" stroke={colors.bg} />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatCreneau(heureDebut?: string, heureFin?: string, dateStr?: string): string {
  if (!heureDebut || !heureFin) return '';
  const dateLabel = dateStr
    ? (() => {
        const d = new Date(dateStr + 'T00:00:00');
        return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · `;
      })()
    : '';
  return `${dateLabel}${heureDebut} → ${heureFin}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanResult =
  | { type: 'success'; creneau: string }
  | { type: 'error'; message: string }
  | null;

interface Props {
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainScanScreen({ onBack }: Props) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const verify = async (cleaned: string) => {
    if (!cleaned || cleaned.length < 4) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await terrainsService.verifyTerrainReceipt(cleaned, prestataireId);
      if (res.success) {
        setResult({
          type: 'success',
          creneau: formatCreneau(res.heure_debut, res.heure_fin, res.date_reservation),
        });
      } else {
        setResult({ type: 'error', message: res.error ?? 'Code invalide' });
      }
    } catch (err) {
      setResult({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = () => verify(code.trim().toUpperCase());

  const handleCameraScan = (scanned: string) => {
    setCameraOpen(false);
    setCode(scanned);
    verify(scanned);
  };

  const handleReset = () => {
    setCode('');
    setResult(null);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Valider un QR code</Text>
      </View>

      <View style={styles.body}>
        {result ? (
          /* ── Résultat ── */
          <View style={styles.resultBox}>
            {result.type === 'success' ? <IcoCheck /> : <IcoX />}
            <Text style={[styles.resultTitle, { color: result.type === 'success' ? colors.success : colors.danger }]}>
              {result.type === 'success' ? 'Accès autorisé ✓' : 'Accès refusé'}
            </Text>
            <Text style={styles.resultMsg}>
              {result.type === 'success' ? `Créneau : ${result.creneau}` : result.message}
            </Text>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.85}>
              <Text style={styles.resetTxt}>Scanner un autre code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Saisie + bouton caméra ── */
          <View style={styles.inputBox}>
            {/* Bouton scanner caméra */}
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={() => setCameraOpen(true)}
              activeOpacity={0.85}
            >
              <IcoScan />
              <Text style={styles.cameraTxt}>Scanner avec la caméra</Text>
            </TouchableOpacity>

            <View style={styles.divRow}>
              <View style={styles.divLine} />
              <Text style={styles.divTxt}>ou saisir manuellement</Text>
              <View style={styles.divLine} />
            </View>

            <Text style={styles.inputTitle}>Entrer le code client</Text>
            <Text style={styles.inputSub}>
              8 caractères affichés sous le QR du client
            </Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={v => setCode(v.toUpperCase().slice(0, 8))}
              placeholder="Ex : A3F7B2C1"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus={false}
            />

            <TouchableOpacity
              style={[styles.verifyBtn, (code.trim().length < 4 || verifying) && { opacity: 0.5 }]}
              onPress={handleManualVerify}
              activeOpacity={0.85}
              disabled={code.trim().length < 4 || verifying}
            >
              {verifying ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.verifyTxt}>Vérifier ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Modal caméra */}
      <QRScannerCamera
        visible={cameraOpen}
        onScan={handleCameraScan}
        onClose={() => setCameraOpen(false)}
      />
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
    paddingBottom: BOTTOM_PAD,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  inputBox: {
    width: '100%', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 24,
    alignItems: 'center', gap: 14,
  },

  cameraBtn: {
    width: '100%', height: 56, borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  cameraTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  divRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  inputTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16, textAlign: 'center' },
  inputSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  codeInput: {
    width: '100%', height: 60, backgroundColor: colors.bg,
    borderWidth: 2, borderColor: colors.accent, borderRadius: radius.lg,
    color: colors.white, fontFamily: fonts.titleXL, fontSize: 26,
    textAlign: 'center', letterSpacing: 6,
  },
  verifyBtn: {
    width: '100%', height: 54, borderRadius: radius.lg,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  verifyTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  resultBox: {
    width: '100%', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 32,
    alignItems: 'center', gap: 14,
  },
  resultTitle: { fontFamily: fonts.titleXL, fontSize: 22 },
  resultMsg: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  resetBtn: {
    marginTop: 8, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 24, paddingVertical: 12,
  },
  resetTxt: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
});
