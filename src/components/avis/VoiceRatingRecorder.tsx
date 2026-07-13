import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

type RecState = 'idle' | 'recording' | 'recorded' | 'playing';

const MAX_SEC = 90;

const IcoMic = ({ active }: { active?: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={9} y={2} width={6} height={12} rx={3} stroke={active ? colors.accent : colors.muted} />
    <Path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke={active ? colors.accent : colors.muted} />
  </Svg>
);

const IcoStop = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={4} width={16} height={16} rx={2} fill="#E07A7A" />
  </Svg>
);

const IcoPlay = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3l14 9-14 9V3z" fill={colors.accent} />
  </Svg>
);

const IcoPause = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Rect x={6} y={4} width={4} height={16} rx={1} fill={colors.accent} />
    <Rect x={14} y={4} width={4} height={16} rx={1} fill={colors.accent} />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={colors.muted} />
    <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={colors.muted} />
  </Svg>
);

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  onUri: (uri: string | null) => void;
}

export default function VoiceRatingRecorder({ onUri }: Props) {
  const [recState, setRecState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [recDuration, setRecDuration] = useState(0);
  const [permGranted, setPermGranted] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localUri = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    Audio.requestPermissionsAsync().then(({ granted }) => setPermGranted(granted));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopRec = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = rec.getURI() ?? null;
      localUri.current = uri;
      onUri(uri);
      setRecDuration(elapsedRef.current);
      setElapsed(elapsedRef.current);
      setRecState('recorded');
    } catch {}
  }, [onUri]);

  const startRec = async () => {
    if (!permGranted) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      elapsedRef.current = 0;
      setElapsed(0);
      setRecState('recording');
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_SEC) stopRec();
      }, 1000);
    } catch {}
  };

  const playRec = async () => {
    if (!localUri.current) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri.current },
        { shouldPlay: true },
        status => {
          if (!status.isLoaded) return;
          setElapsed(Math.floor((status.positionMillis ?? 0) / 1000));
          if (status.didJustFinish) {
            setRecState('recorded');
            setElapsed(0);
            sound.unloadAsync().catch(() => {});
          }
        },
      );
      soundRef.current = sound;
      setRecState('playing');
    } catch {}
  };

  const pauseRec = async () => {
    await soundRef.current?.pauseAsync().catch(() => {});
    setRecState('recorded');
  };

  const deleteRec = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    localUri.current = null;
    onUri(null);
    elapsedRef.current = 0;
    setElapsed(0);
    setRecDuration(0);
    setRecState('idle');
  };

  if (!permGranted) return null;

  if (recState === 'idle') {
    return (
      <TouchableOpacity style={styles.idleRow} onPress={startRec} activeOpacity={0.75}>
        <IcoMic />
        <Text style={styles.idleTxt}>Message vocal (optionnel)</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.activeRow}>
      {recState === 'recording' && (
        <>
          <View style={styles.recDot} />
          <IcoMic active />
          <Text style={styles.timer}>{fmt(elapsed)}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.roundBtn} onPress={stopRec} activeOpacity={0.8}>
            <IcoStop />
          </TouchableOpacity>
        </>
      )}
      {(recState === 'recorded' || recState === 'playing') && (
        <>
          <TouchableOpacity
            style={styles.roundBtn}
            onPress={recState === 'playing' ? pauseRec : playRec}
            activeOpacity={0.8}
          >
            {recState === 'playing' ? <IcoPause /> : <IcoPlay />}
          </TouchableOpacity>
          <Text style={styles.timer}>
            {recState === 'playing' ? `${fmt(elapsed)} / ` : ''}{fmt(recDuration)}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.roundBtn} onPress={deleteRec} activeOpacity={0.8}>
            <IcoTrash />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  idleTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E07A7A',
  },
  timer: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    minWidth: 38,
  },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
