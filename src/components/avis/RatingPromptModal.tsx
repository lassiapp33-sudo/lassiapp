import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import StarRating from './StarRating';
import VoiceRatingRecorder from './VoiceRatingRecorder';
import { colors, fonts, radius } from '../../theme';
import { soumettreNote, uploadVocalRating, RatingDirection } from '../../services/orderRating';
import { notifyError } from '../../utils/errorUtils';

interface Props {
  visible: boolean;
  orderId: string;
  direction: RatingDirection;
  targetName: string;
  onDismiss: () => void;
}

export default function RatingPromptModal({
  visible,
  orderId,
  direction,
  targetName,
  onDismiss,
}: Props) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [vocalUri, setVocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isClient = direction === 'client_to_merchant';
  const title = isClient ? 'Comment s\'est passée ta commande ?' : 'Note ce client';
  const subtitle = isClient ? `Chez ${targetName}` : targetName;

  const handleValider = async () => {
    if (note === 0 || loading) return;
    setLoading(true);
    try {
      let vocalUrl: string | undefined;
      if (vocalUri) {
        vocalUrl = await uploadVocalRating(orderId, direction, vocalUri);
      }
      await soumettreNote(orderId, direction, note, commentaire.trim() || undefined, vocalUrl);
    } catch {
      notifyError('Impossible d\'enregistrer ta note. Réessaie plus tard.');
    } finally {
      setLoading(false);
      reset();
      onDismiss();
    }
  };

  const reset = () => {
    setNote(0);
    setCommentaire('');
    setVocalUri(null);
  };

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>

          <View style={styles.starsRow}>
            <StarRating value={note} onChange={setNote} size={38} gap={10} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Ajouter un commentaire (optionnel)"
            placeholderTextColor={colors.muted}
            value={commentaire}
            onChangeText={setCommentaire}
            maxLength={200}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <VoiceRatingRecorder onUri={setVocalUri} />

          <View style={styles.btns}>
            <TouchableOpacity
              style={styles.btnIgnorer}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.btnIgnorerTxt}>Ignorer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnValider, (note === 0 || loading) && styles.btnDisabled]}
              onPress={handleValider}
              activeOpacity={0.85}
              disabled={note === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.btnValiderTxt}>Valider ma note</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Ta note est confidentielle et améliore les classements LASSI.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
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
    marginBottom: 22,
  },
  starsRow: {
    alignItems: 'center',
    marginBottom: 22,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 72,
    marginBottom: 20,
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
