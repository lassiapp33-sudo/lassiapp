/**
 * DeleteAccountModal — confirmation en 2 étapes avant suppression définitive.
 *
 * Étape 1 : Explication des conséquences + case à cocher.
 * Étape 2 : Bouton rouge activé → suppression en cours → succès/erreur.
 *
 * Conforme aux exigences Apple App Store (suppression accessible depuis l'app).
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { deleteAccount } from '../../services/account';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoTrash = ({ color }: { color: string }) => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polyline points="3 6 5 6 21 6" stroke={color} />
    <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={color} />
    <Path d="M10 11v6M14 11v6" stroke={color} />
    <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={color} />
  </Svg>
);

const IcoCheck = () => (
  <Svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 6L9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

const IcoWarning = () => (
  <Svg
    width={28}
    height={28}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M10.3 3.4L2 19h20L13.7 3.4a2 2 0 0 0-3.4 0Z" stroke={colors.danger} />
    <Path d="M12 9v5M12 17h.01" stroke={colors.danger} />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  role: 'client' | 'merchant';
  onClose: () => void;
  onSuccess: () => void; // appelée après suppression → navigue vers Welcome
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function DeleteAccountModal({ visible, role, onClose, onSuccess }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Réinitialiser l'état à chaque ouverture
  const handleClose = () => {
    if (loading) return;
    setConfirmed(false);
    setErreur(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    setErreur(null);
    try {
      await deleteAccount();
      onSuccess();
    } catch (e: unknown) {
      setErreur(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Texte des conséquences selon le rôle
  const consequences =
    role === 'merchant'
      ? 'Tes données seront supprimées : commandes, cahier de dettes, conversations. Ta vitrine et tes produits seront retirés et ne seront plus visibles des clients.'
      : 'Tes données seront supprimées : commandes, favoris, conversations et historique de paiements.';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── Icône danger ─────────────────────────────────────────────── */}
          <View style={styles.iconBox}>
            <IcoWarning />
          </View>

          {/* ── Titre ────────────────────────────────────────────────────── */}
          <Text style={styles.title}>Supprimer ton compte ?</Text>

          {/* ── Conséquences ─────────────────────────────────────────────── */}
          <View style={styles.warnBox}>
            <Text style={styles.warnLabel}>⚠️ Cette action est définitive</Text>
            <Text style={styles.warnBody}>{consequences}</Text>
          </View>

          {/* ── Case à cocher ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setConfirmed(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
              {confirmed && <IcoCheck />}
            </View>
            <Text style={styles.checkLabel}>Je comprends que cette suppression est définitive</Text>
          </TouchableOpacity>

          {/* ── Erreur ───────────────────────────────────────────────────── */}
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          {/* ── Boutons ──────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.deleteBtn, (!confirmed || loading) && styles.deleteBtnOff]}
            onPress={handleDelete}
            activeOpacity={0.85}
            disabled={!confirmed || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.deleteBtnTxt}>Suppression en cours…</Text>
              </>
            ) : (
              <>
                <IcoTrash color={colors.white} />
                <Text style={styles.deleteBtnTxt}>Supprimer définitivement</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.cancelBtnTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BOTTOM = Platform.OS === 'ios' ? 34 : 20;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: BOTTOM + 12,
    gap: 16,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(224,122,122,.1)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.25)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    textAlign: 'center',
  },

  warnBox: {
    backgroundColor: 'rgba(224,122,122,.07)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.2)',
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  warnLabel: {
    color: colors.danger,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  warnBody: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  checkLabel: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },

  erreur: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
  },

  deleteBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  deleteBtnOff: { opacity: 0.35 },
  deleteBtnTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  cancelBtn: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
});
