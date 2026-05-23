import React from 'react';
import {
  View, TextInput, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.muted} />
  </Svg>
);

const IcoMic = () => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={colors.bg} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.bg} />
    <Path d="M12 19v3" stroke={colors.bg} />
  </Svg>
);

const IcoSend = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 2 11 13" stroke={colors.bg} />
    <Path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke={colors.bg} />
  </Svg>
);

// ─── Padding bas pour le home indicator iOS ───────────────────────────────────
const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 10;

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  value:      string;
  onChange:   (text: string) => void;
  onSend:     () => void;   // envoie le texte ou un message vocal simulé
  onAttach?:  () => void;
}

export default function ChatComposer({ value, onChange, onSend, onAttach }: Props) {
  const hasText = value.trim().length > 0;

  return (
    <View style={[styles.bar, { paddingBottom: BOTTOM_PAD }]}>
      {/* Bouton + (pièce jointe, photo…) */}
      <TouchableOpacity style={styles.plusBtn} onPress={onAttach} activeOpacity={0.8}>
        <IcoPlus />
      </TouchableOpacity>

      {/* Champ de saisie */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Écris un message…"
        placeholderTextColor="#5a5c80"
        multiline
        maxLength={800}
        returnKeyType="send"
        onSubmitEditing={hasText ? onSend : undefined}
      />

      {/* Micro (enregistrement) OU Envoyer (si texte) */}
      <TouchableOpacity style={styles.micBtn} onPress={onSend} activeOpacity={0.85}>
        {hasText ? <IcoSend /> : <IcoMic />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },

  plusBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  micBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
