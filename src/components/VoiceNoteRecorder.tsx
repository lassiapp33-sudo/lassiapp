import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const MAX_SECONDS = 60;

interface Props {
  onRecordingComplete: (uri: string | null) => void;
}

const IcoMic = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke={colors.muted} />
    <Path d="M19 10a7 7 0 0 1-14 0" stroke={colors.muted} />
    <Path d="M12 19v3M9 22h6" stroke={colors.muted} />
  </Svg>
);

const IcoPlay = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill={colors.accent}>
    <Path d="M5 3l14 9-14 9V3z" />
  </Svg>
);

const IcoPause = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill={colors.accent}>
    <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.muted} />
  </Svg>
);

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VoiceNoteRecorder({ onRecordingComplete }: Props) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorise le micro dans les paramètres pour enregistrer un message vocal.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      secondsRef.current = 0;
      setSeconds(0);
      setPhase('recording');
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) stopRecording();
      }, 1000);
    } catch {
      Alert.alert('Erreur', "L'enregistrement n'a pas pu démarrer.");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const fileUri = rec.getURI();
      if (fileUri && secondsRef.current > 0) {
        setUri(fileUri);
        setPhase('done');
        onRecordingComplete(fileUri);
      } else {
        setPhase('idle');
      }
    } catch {
      setPhase('idle');
    }
  };

  const togglePreview = async () => {
    if (!uri) return;
    if (playing) {
      await soundRef.current?.pauseAsync().catch(() => {});
      setPlaying(false);
      return;
    }
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(st => {
        if (st.isLoaded && st.didJustFinish) setPlaying(false);
      });
      await sound.playAsync();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const deleteRecording = async () => {
    if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
    setUri(null);
    setPhase('idle');
    setSeconds(0);
    setPlaying(false);
    onRecordingComplete(null);
  };

  if (phase === 'idle') {
    return (
      <TouchableOpacity style={styles.idleBtn} onPress={startRecording} activeOpacity={0.75}>
        <IcoMic />
        <Text style={styles.idleTxt}>Ajouter un message vocal</Text>
      </TouchableOpacity>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={styles.row}>
        <View style={styles.recDot} />
        <Text style={styles.recTimer}>{formatTime(seconds)}</Text>
        <Text style={styles.recHint}>Enregistrement en cours…</Text>
        <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.8}>
          <Text style={styles.stopTxt}>Arrêter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.playBtn} onPress={togglePreview} activeOpacity={0.8}>
        {playing ? <IcoPause /> : <IcoPlay />}
      </TouchableOpacity>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke={colors.accent} />
        <Path d="M19 10a7 7 0 0 1-14 0" stroke={colors.accent} />
        <Path d="M12 19v3M9 22h6" stroke={colors.accent} />
      </Svg>
      <Text style={styles.doneTxt}>{formatTime(seconds)}</Text>
      <TouchableOpacity style={styles.delBtn} onPress={deleteRecording} activeOpacity={0.8}>
        <IcoTrash />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  idleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  idleTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },

  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e07a7a',
  },
  recTimer: {
    color: '#e07a7a',
    fontFamily: fonts.titleXL,
    fontSize: 13,
    minWidth: 30,
  },
  recHint: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },
  stopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(224,122,122,.15)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.3)',
  },
  stopTxt: {
    color: '#e07a7a',
    fontFamily: fonts.title,
    fontSize: 11.5,
  },

  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTxt: {
    flex: 1,
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 12.5,
  },
  delBtn: {
    padding: 5,
  },
});
