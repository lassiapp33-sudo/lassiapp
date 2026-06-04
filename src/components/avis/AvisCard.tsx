import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import StarRating from './StarRating';
import { Avis } from '../../types/avis';
import * as avisService from '../../services/avis';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoEdit = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.muted} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.muted} />
  </Svg>
);

const IcoTrash = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.danger} />
  </Svg>
);

const IcoFlag = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke={colors.muted} />
    <Path d="M4 22v-7" stroke={colors.muted} />
  </Svg>
);

const IcoReply = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" stroke={colors.accent} />
    <Path d="m15 11 4 4-4 4M11 17h8" stroke={colors.accent} />
  </Svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  avis: Avis;
  isOwn?: boolean;
  isMerchant?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onRefresh?: () => void;
}

function AvisCard({ avis, isOwn, isMerchant, onEdit, onDelete, onReport, onRefresh }: Props) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDelete = () => {
    Alert.alert('Supprimer cet avis', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
    ]);
  };

  const handleSaveReply = async () => {
    setSaving(true);
    try {
      await avisService.respondToAvis(avis.id, replyText);
      setShowReplyBox(false);
      onRefresh?.();
    } catch {
      Alert.alert('Erreur', 'Impossible de publier la réponse. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* ── En-tête auteur ── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initial(avis.authorName)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.authorName}>{avis.authorName}</Text>
          <Text style={styles.date}>{formatDate(avis.createdAt)}</Text>
        </View>
        <StarRating value={avis.note} size={14} gap={3} />
      </View>

      {/* ── Commentaire ── */}
      {!!avis.commentaire && <Text style={styles.comment}>{avis.commentaire}</Text>}

      {/* ── Photo ── */}
      {!!avis.photoUrl && (
        <Image source={{ uri: avis.photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      {/* ── Actions auteur / signalement ── */}
      <View style={styles.actions}>
        {isOwn && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
              <IcoEdit />
              <Text style={styles.actionTxt}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
              <IcoTrash />
              <Text style={[styles.actionTxt, { color: colors.danger }]}>Supprimer</Text>
            </TouchableOpacity>
          </>
        )}
        {!isOwn && (
          <TouchableOpacity style={styles.actionBtn} onPress={onReport} activeOpacity={0.7}>
            <IcoFlag />
            <Text style={styles.actionTxt}>Signaler</Text>
          </TouchableOpacity>
        )}
        {isMerchant && !isOwn && !avis.reponseCommercant && (
          <TouchableOpacity
            style={[styles.actionBtn, { marginLeft: 'auto' }]}
            onPress={() => setShowReplyBox(v => !v)}
            activeOpacity={0.7}
          >
            <IcoReply />
            <Text style={[styles.actionTxt, { color: colors.accent }]}>Répondre</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Réponse existante du commerçant ── */}
      {!!avis.reponseCommercant && !showReplyBox && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Réponse du commerçant</Text>
          <Text style={styles.replyTxt}>{avis.reponseCommercant}</Text>
        </View>
      )}

      {/* ── Zone de saisie réponse (prestataire) ── */}
      {showReplyBox && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.replyInput}
        >
          <TextInput
            style={styles.replyTextInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Votre réponse (max 500 caractères)…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />
          <View style={styles.replyFooter}>
            <TouchableOpacity onPress={() => setShowReplyBox(false)} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.publishBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveReply}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={styles.publishTxt}>Publier</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

export default React.memo(AvisCard);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253,207,52,.15)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  headerInfo: { flex: 1 },
  authorName: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  date: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },

  comment: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },

  photo: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: 10,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },

  replyBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  replyLabel: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 10.5,
    marginBottom: 4,
  },
  replyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },

  replyInput: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyTextInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  replyFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  publishBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  publishTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
