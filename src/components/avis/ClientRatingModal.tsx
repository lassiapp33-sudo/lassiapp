import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { soumettreNote } from '../../services/orderRating';
import { notifyError } from '../../utils/errorUtils';

interface Props {
  visible: boolean;
  orderId: string;
  clientName: string;
  onDismiss: () => void;
}

export default function ClientRatingModal({ visible, orderId, clientName, onDismiss }: Props) {
  const [selected, setSelected] = useState<1 | 5 | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValider = async () => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      await soumettreNote(orderId, 'merchant_to_client', selected);
    } catch {
      notifyError('Impossible d\'enregistrer la note. Réessaie.');
    } finally {
      setLoading(false);
      setSelected(null);
      onDismiss();
    }
  };

  const handleDismiss = () => {
    setSelected(null);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Note ce client</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{clientName}</Text>

          <View style={styles.choices}>
            {/* Option : peu sérieux (1★) */}
            <TouchableOpacity
              style={[styles.card, selected === 1 && styles.cardPeuSerieux]}
              onPress={() => setSelected(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardEmoji}>😤</Text>
              <Text style={styles.cardStars}>★</Text>
              <Text style={[styles.cardLabel, selected === 1 && { color: colors.danger }]}>
                Peu sérieux
              </Text>
            </TouchableOpacity>

            {/* Option : sérieux (5★) */}
            <TouchableOpacity
              style={[styles.card, selected === 5 && styles.cardSerieux]}
              onPress={() => setSelected(5)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardEmoji}>😊</Text>
              <Text style={[styles.cardStars, styles.cardStarsFull]}>★★★★★</Text>
              <Text style={[styles.cardLabel, selected === 5 && { color: colors.success }]}>
                Sérieux
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.btnIgnorer} onPress={handleDismiss} activeOpacity={0.8}>
              <Text style={styles.btnIgnorerTxt}>Ignorer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnValider, (!selected || loading) && styles.btnDisabled]}
              onPress={handleValider}
              activeOpacity={0.85}
              disabled={!selected || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.btnValiderTxt}>Valider ma note</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            La note de fiabilité du client est visible uniquement par les prestataires LASSI.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },

  choices: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 6,
    backgroundColor: 'transparent',
  },
  cardPeuSerieux: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(224,122,122,0.08)',
  },
  cardSerieux: {
    borderColor: colors.success,
    backgroundColor: 'rgba(95,211,138,0.08)',
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardStars: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  cardStarsFull: {
    color: colors.accent,
  },
  cardLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 12,
  },

  btns: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  btnIgnorer: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIgnorerTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  btnValider: {
    flex: 2,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnValiderTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
