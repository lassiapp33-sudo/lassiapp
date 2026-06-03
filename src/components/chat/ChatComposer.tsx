import React, { useRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text,
  StyleSheet, Platform, PanResponder, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { IcoClose, IcoPlus } from '../icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoMic = ({ color = colors.bg }: { color?: string }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={color} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2"                              stroke={color} />
    <Path d="M12 19v3"                                                  stroke={color} />
  </Svg>
);

const IcoSend = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 2 11 13" stroke={colors.bg} />
    <Path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke={colors.bg} />
  </Svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 10;

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  value:        string;
  onChange:     (text: string) => void;
  onSend:       () => void;
  onVoiceSend:  (uri: string, duration: number) => Promise<void>;
  onAttach?:    () => void;
  disabled?:    boolean;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ChatComposer({
  value, onChange, onSend, onVoiceSend, onAttach, disabled,
}: Props) {
  const hasText = value.trim().length > 0;

  const { isRecording, elapsed, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder();

  // Indique si l'utilisateur glisse vers le haut (intention d'annuler)
  const [cancelIntent, setCancelIntent] = useState(false);
  const [uploading,    setUploading]    = useState(false);

  // Animation pulsation du point rouge
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ]),
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulse.setValue(1);
  };

  // ── PanResponder sur le bouton micro ─────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !hasText && !uploading,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: () => {
        startRecording();
        startPulse();
        setCancelIntent(false);
      },

      onPanResponderMove: (_evt, gs) => {
        // Glisser > 60 dp vers le haut → intention d'annuler
        setCancelIntent(gs.dy < -60);
      },

      onPanResponderRelease: async (_evt, gs) => {
        stopPulse();
        if (gs.dy < -60) {
          await cancelRecording();
          setCancelIntent(false);
          return;
        }
        setCancelIntent(false);
        const result = await stopRecording();
        if (!result) return; // trop court ou erreur
        setUploading(true);
        try {
          await onVoiceSend(result.uri, result.duration);
        } finally {
          setUploading(false);
        }
      },

      onPanResponderTerminate: async () => {
        stopPulse();
        setCancelIntent(false);
        await cancelRecording();
      },
    }),
  ).current;

  // ── UI enregistrement ─────────────────────────────────────────────────────
  if (isRecording || uploading) {
    return (
      <View style={[styles.bar, { paddingBottom: BOTTOM_PAD }]}>
        {/* Bouton annuler */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={cancelRecording}
          activeOpacity={0.7}
        >
          <IcoClose color={colors.muted} />
        </TouchableOpacity>

        {/* Indicateur enregistrement */}
        <View style={styles.recordingRow}>
          {uploading ? (
            <Text style={styles.uploadingText}>Envoi…</Text>
          ) : (
            <>
              <Animated.View
                style={[
                  styles.redDot,
                  cancelIntent && styles.redDotCancel,
                  { transform: [{ scale: pulse }] },
                ]}
              />
              <Text style={[styles.elapsedText, cancelIntent && styles.cancelText]}>
                {fmtElapsed(elapsed)}
              </Text>
              <Text style={styles.hintText}>
                {cancelIntent ? '↑ Relâcher pour annuler' : '↑ Glisser pour annuler'}
              </Text>
            </>
          )}
        </View>

        {/* Bouton stop/send (désactivé pendant l'upload) */}
        <TouchableOpacity
          style={[styles.micBtn, uploading && { opacity: 0.4 }]}
          disabled={uploading}
          onPress={async () => {
            stopPulse();
            const result = await stopRecording();
            if (!result) return;
            setUploading(true);
            try { await onVoiceSend(result.uri, result.duration); }
            finally { setUploading(false); }
          }}
          activeOpacity={0.85}
        >
          <IcoMic />
        </TouchableOpacity>
      </View>
    );
  }

  // ── UI normale ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.bar, { paddingBottom: BOTTOM_PAD }]}>
      {/* Bouton + (pièce jointe) */}
      <TouchableOpacity style={styles.plusBtn} onPress={onAttach} activeOpacity={0.75}>
        <IcoPlus />
      </TouchableOpacity>

      {/* Champ texte */}
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
        editable={!disabled}
      />

      {/* Micro (press-and-hold) ou Envoyer (si texte) */}
      {hasText ? (
        <TouchableOpacity style={styles.micBtn} onPress={onSend} activeOpacity={0.85}>
          <IcoSend />
        </TouchableOpacity>
      ) : (
        <View
          style={styles.micBtn}
          {...panResponder.panHandlers}
        >
          <IcoMic />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingHorizontal: 14,
    paddingTop:       10,
    borderTopWidth:   1,
    borderTopColor:   colors.border,
    backgroundColor:  colors.bg,
  },

  plusBtn: {
    width:           42,
    height:          42,
    borderRadius:    13,
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  input: {
    flex:             1,
    minHeight:        46,
    maxHeight:        100,
    backgroundColor:  colors.surface,
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     radius.md,
    paddingHorizontal: 14,
    paddingVertical:  12,
    color:            colors.white,
    fontFamily:       fonts.body,
    fontSize:         13,
  },

  micBtn: {
    width:           46,
    height:          46,
    borderRadius:    radius.md,
    backgroundColor: colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  // ── État enregistrement ──────────────────────────────────────────────────
  cancelBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     '#ff4d4f44',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  recordingRow: {
    flex:        1,
    flexDirection: 'row',
    alignItems:  'center',
    gap:         8,
    height:      46,
    paddingHorizontal: 10,
    backgroundColor:   colors.surface,
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      radius.md,
  },

  redDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#ff4d4f',
    flexShrink:      0,
  },

  redDotCancel: {
    backgroundColor: '#aaa',
  },

  elapsedText: {
    color:       colors.white,
    fontFamily:  fonts.title,
    fontSize:    14,
    flexShrink:  0,
  },

  cancelText: {
    color: '#aaa',
  },

  hintText: {
    color:       '#5a5c80',
    fontFamily:  fonts.body,
    fontSize:    11,
    flex:        1,
  },

  uploadingText: {
    color:       '#5a5c80',
    fontFamily:  fonts.body,
    fontSize:    13,
    flex:        1,
  },
});
