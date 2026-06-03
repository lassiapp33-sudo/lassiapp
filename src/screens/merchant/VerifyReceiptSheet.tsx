import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { IcoClose } from '../../components/icons';
import { verifyReceiptMerchant, VerifyResult } from '../../services/receipts';
import { getErrorMessage } from '../../utils/errorUtils';
import { formatPrice } from '../../utils/format';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCloseBtn = () => <IcoClose color={colors.muted} />;

const IcoCheck = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.success} />
  </Svg>
);

const IcoX = () => <IcoClose size={28} color={colors.danger} />;

// ─── Messages d'erreur lisibles ───────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  introuvable:  'Code introuvable. Vérifie le code et réessaie.',
  expire:       'Ce reçu a expiré (délai de 40 min dépassé).',
  deja_utilise: 'Ce reçu a déjà été utilisé.',
  aucun:        'Aucun reçu associé à ce code.',
};

function reasonLabel(reason?: string): string {
  if (!reason) return 'Une erreur est survenue. Réessaie.';
  return REASON_LABELS[reason] ?? `Erreur : ${reason}`;
}

// ─── Formatage du code en XXXX XXXX ──────────────────────────────────────────

function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)} ${clean.slice(4)}`;
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onVerified?: (result: VerifyResult) => void;
}

export default function VerifyReceiptSheet({ visible, onClose, onVerified }: Props) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<VerifyResult | null>(null);
  const inputRef = useRef<TextInput>(null);

  const rawCode = code.replace(/\s/g, '');

  const handleClose = () => {
    setCode('');
    setResult(null);
    onClose();
  };

  const handleVerify = async () => {
    if (rawCode.length < 8) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyReceiptMerchant(rawCode);
      setResult(res);
      if (res.success) onVerified?.(res);
    } catch (e: unknown) {
      setResult({ success: false, reason: getErrorMessage(e, 'erreur_reseau') });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCode('');
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kavWrapper}
        >
          <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />

          <View style={s.sheet}>
            {/* En-tête */}
            <View style={s.sheetHeader}>
              <View style={s.grab} />
              <View style={s.titleRow}>
                <Text style={s.title}>Vérifier un reçu</Text>
                <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                  <IcoCloseBtn />
                </TouchableOpacity>
              </View>
              <Text style={s.subtitle}>
                Saisis le code à 8 caractères affiché sur le reçu du client.
              </Text>
            </View>

            {/* Résultat : succès */}
            {result?.success && (
              <View style={s.resultSuccess}>
                <IcoCheck />
                <View style={{ flex: 1 }}>
                  <Text style={s.resultSuccessTitle}>Reçu validé ✓</Text>
                  {result.clientName && (
                    <Text style={s.resultSuccessSub}>Client : {result.clientName}</Text>
                  )}
                  {result.total !== undefined && (
                    <Text style={s.resultSuccessSub}>
                      Total : {formatPrice(result.total)}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Résultat : échec */}
            {result && !result.success && (
              <View style={s.resultError}>
                <IcoX />
                <Text style={s.resultErrorTxt}>{reasonLabel(result.reason)}</Text>
              </View>
            )}

            {/* Champ de saisie (masqué si succès) */}
            {!result?.success && (
              <>
                <View style={s.inputWrap}>
                  <TextInput
                    ref={inputRef}
                    style={s.input}
                    value={code}
                    onChangeText={v => setCode(formatCode(v))}
                    placeholder="XXXX XXXX"
                    placeholderTextColor={colors.border}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    returnKeyType="done"
                    onSubmitEditing={handleVerify}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[s.btn, (rawCode.length < 8 || loading) && s.btnDisabled]}
                  onPress={handleVerify}
                  activeOpacity={0.85}
                  disabled={rawCode.length < 8 || loading}
                >
                  {loading
                    ? <ActivityIndicator color={colors.bg} size="small" />
                    : <Text style={s.btnTxt}>Vérifier le reçu</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* Bouton "Nouveau code" après succès ou échec */}
            {result && (
              <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.8}>
                <Text style={s.resetTxt}>
                  {result.success ? 'Vérifier un autre reçu' : 'Réessayer avec un autre code'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    borderTopWidth: 1,
    borderColor: colors.border,
  },

  grab: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 14,
  },
  sheetHeader: { marginBottom: 20 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },
  closeBtn: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },

  // Résultats
  resultSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(95,211,138,0.1)',
    borderWidth: 1, borderColor: 'rgba(95,211,138,0.3)',
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 16,
  },
  resultSuccessTitle: {
    color: colors.success,
    fontFamily: fonts.titleXL,
    fontSize: 16, marginBottom: 4,
  },
  resultSuccessSub: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  resultError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(224,122,122,0.1)',
    borderWidth: 1, borderColor: 'rgba(224,122,122,0.3)',
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 16,
  },
  resultErrorTxt: {
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },

  // Input
  inputWrap: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  input: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 30,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },

  btn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  resetBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resetTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
