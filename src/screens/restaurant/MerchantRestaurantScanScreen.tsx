import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { validateStdTableArrival } from '../../services/tableReservations';
import { getErrorMessage } from '../../utils/errorUtils';

interface Props {
  onBack: () => void;
}

export default function MerchantRestaurantScanScreen({ onBack }: Props) {
  const [qrCode, setQrCode]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{
    nbPersonnes?: number;
    acompteADeduire?: number;
    motif?: string;
    options?: string[];
  } | null>(null);

  const handleValidate = async () => {
    const code = qrCode.trim().toUpperCase();
    if (!code) { Alert.alert('Erreur', 'Saisissez le code QR'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await validateStdTableArrival(code);
      setResult(res);
      setQrCode('');
    } catch (err) {
      Alert.alert('Validation échouée', getErrorMessage(err));
    } finally {
      setLoading(false);
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
        <Text style={s.headerTitle}>Scan arrivée</Text>
      </View>

      <View style={s.content}>
        <View style={s.scanIcon}>
          <Svg width={56} height={56} viewBox="0 0 24 24">
            <Rect x="3" y="3" width="7" height="7" rx="1" stroke={colors.accent} strokeWidth={1.5} fill="none"/>
            <Rect x="14" y="3" width="7" height="7" rx="1" stroke={colors.accent} strokeWidth={1.5} fill="none"/>
            <Rect x="3" y="14" width="7" height="7" rx="1" stroke={colors.accent} strokeWidth={1.5} fill="none"/>
            <Path d="M14 14h2v2h-2zM18 14h3M14 18v3M18 18h3v3h-3z" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
          </Svg>
        </View>

        <Text style={s.instruction}>
          Saisissez le code du ticket client{'\n'}(format : RESA-XXXXXX)
        </Text>

        <TextInput
          style={s.input}
          placeholder="Ex : RESA-AB12CD"
          placeholderTextColor={colors.muted}
          value={qrCode}
          onChangeText={v => setQrCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
        />

        <TouchableOpacity
          style={[s.validateBtn, loading && { opacity: 0.6 }]}
          onPress={handleValidate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={s.validateBtnTxt}>Valider l'arrivée</Text>
          }
        </TouchableOpacity>

        {result && (
          <View style={s.resultCard}>
            <View style={s.resultSuccess}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                  stroke="#27AE60" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </Svg>
              <Text style={s.resultSuccessTxt}>Arrivée validée</Text>
            </View>
            <Text style={s.resultLine}>
              {result.nbPersonnes} personne{(result.nbPersonnes ?? 0) > 1 ? 's' : ''}
            </Text>
            <View style={s.acompteBox}>
              <Text style={s.acompteLabel}>Acompte à déduire :</Text>
              <Text style={s.acompteVal}>
                {result.acompteADeduire?.toLocaleString('fr-FR') ?? '3 000'} FCFA
              </Text>
            </View>
            {result.motif && (
              <Text style={s.resultLine}>Occasion : {result.motif}</Text>
            )}
            {result.options && result.options.length > 0 && (
              <Text style={s.resultLine}>Options : {result.options.join(', ')}</Text>
            )}
          </View>
        )}
      </View>
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

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },

  scanIcon:    { marginBottom: 20 },
  instruction: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 14,
    textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },

  input: {
    width: '100%', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14,
    color: colors.white, fontFamily: fonts.title, fontSize: 18,
    backgroundColor: colors.surface, textAlign: 'center', letterSpacing: 4,
    marginBottom: 16,
  },

  validateBtn: {
    width: '100%', height: 54, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  validateBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },

  resultCard: {
    width: '100%', marginTop: 24,
    borderWidth: 2, borderColor: '#27AE60', borderRadius: 12,
    backgroundColor: 'rgba(39, 174, 96, 0.08)',
    padding: 16, gap: 10,
  },
  resultSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  resultSuccessTxt: { color: '#27AE60', fontFamily: fonts.title, fontSize: 16 },
  resultLine: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  acompteBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12,
  },
  acompteLabel: { color: colors.muted,  fontFamily: fonts.ui,    fontSize: 13 },
  acompteVal:   { color: colors.accent, fontFamily: fonts.title, fontSize: 18 },
});
