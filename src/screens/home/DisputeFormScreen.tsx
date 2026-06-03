/**
 * DisputeFormScreen — Formulaire de signalement d'un litige.
 * Accès depuis une commande ou une dette via ReportButton.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import * as disputeService from '../../services/disputes';
import * as storageService from '../../services/storage';
import type { DisputeReason } from '../../services/disputes';
import { getErrorMessage } from '../../utils/errorUtils';

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoPlus = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.accent} />
  </Svg>
);

interface Props {
  againstId:  string;
  shopId?:    string;
  type:       'order' | 'debt';
  orderId?:   string;
  debtId?:    string;
  onBack:     () => void;
  onSuccess:  () => void;
}

export default function DisputeFormScreen({
  againstId, shopId, type, orderId, debtId, onBack, onSuccess,
}: Props) {
  const reasons = type === 'order'
    ? disputeService.ORDER_REASONS
    : disputeService.DEBT_REASONS;

  const [reason,      setReason]      = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [photos,      setPhotos]      = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [erreur,      setErreur]      = useState<string | null>(null);

  async function handlePickPhoto() {
    if (photos.length >= 3) return;
    const uri = await storageService.pickImageFromGallery();
    if (uri) setPhotos(prev => [...prev, uri]);
  }

  async function handleSubmit() {
    if (!reason) {
      setErreur('Choisis un motif.');
      return;
    }
    if (description.trim().length < 10) {
      setErreur('Décris le problème en au moins 10 caractères.');
      return;
    }
    setErreur(null);
    setLoading(true);
    try {
      await disputeService.createDispute({
        againstId,
        shopId,
        type,
        orderId,
        debtId,
        reason,
        description: description.trim(),
        evidenceUris: photos,
      });
      Alert.alert(
        'Signalement envoyé',
        'Ton signalement a été transmis. Nous l\'examinerons dans les plus brefs délais.',
        [{ text: 'OK', onPress: onSuccess }],
      );
    } catch (e: unknown) {
      setErreur(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.head}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Signaler un problème</Text>
            <Text style={styles.sub}>
              {type === 'order' ? 'Litige sur commande' : 'Litige sur dette'}
            </Text>
          </View>
        </View>

        <View style={{ height: 24 }} />

        {/* Motif */}
        <Text style={styles.sectionLbl}>Motif du signalement *</Text>
        <View style={styles.reasonList}>
          {reasons.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonChip, reason === r && styles.reasonChipOn]}
              onPress={() => setReason(r)}
              activeOpacity={0.75}
            >
              <Text style={[styles.reasonTxt, reason === r && styles.reasonTxtOn]}>
                {disputeService.REASON_LABELS[r]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 20 }} />

        {/* Description */}
        <Text style={styles.sectionLbl}>Décris le problème *</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Explique ce qui s'est passé, avec le maximum de détails…"
            placeholderTextColor="#5a5c80"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            returnKeyType="done"
          />
        </View>

        <View style={{ height: 20 }} />

        {/* Preuves photos */}
        <Text style={styles.sectionLbl}>
          Photos en preuve <Text style={styles.opt}>(optionnel, max 3)</Text>
        </Text>
        <View style={styles.photoRow}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
              >
                <Text style={styles.photoRemoveTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 3 && (
            <TouchableOpacity style={styles.photoAdd} onPress={handlePickPhoto} activeOpacity={0.75}>
              <IcoPlus />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 16 }} />

        {erreur && <Text style={styles.erreur}>{erreur}</Text>}

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteTxt}>
            ⚖️ Ton signalement sera examiné par l'équipe LASSİ. La partie concernée sera notifiée et pourra donner sa version.
          </Text>
        </View>

        <View style={{ height: 16 }} />

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={styles.btnTxt}>
            {loading ? 'Envoi en cours…' : 'Envoyer le signalement'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
    flexGrow: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  sectionLbl: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  opt: {
    color: colors.muted,
    textTransform: 'none',
    fontSize: 10,
  },

  // Motifs
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipOn: {
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderColor: colors.accent,
  },
  reasonTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  reasonTxtOn: {
    color: colors.accent,
  },

  // Description
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 13,
  },
  input: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13.5,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Photos
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveTxt: {
    color: colors.white,
    fontSize: 10,
    fontFamily: fonts.ui,
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteBox: {
    backgroundColor: 'rgba(253,207,52,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,0.2)',
    borderRadius: radius.md,
    padding: 13,
  },
  noteTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },

  erreur: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },

  btn: {
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
});
