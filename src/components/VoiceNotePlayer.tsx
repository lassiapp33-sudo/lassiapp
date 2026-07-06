import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

interface Props {
  storagePath: string;
}

const IcoPlay = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill={color}>
    <Path d="M5 3l14 9-14 9V3z" />
  </Svg>
);

const IcoPause = ({ color }: { color: string }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </Svg>
);

export default function VoiceNotePlayer({ storagePath }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handleToggle = async () => {
    if (state === 'playing') {
      await soundRef.current?.pauseAsync().catch(() => {});
      setState('paused');
      return;
    }
    if (state === 'paused' && soundRef.current) {
      await soundRef.current.playAsync().catch(() => {});
      setState('playing');
      return;
    }

    setState('loading');
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
      const { data, error } = await supabase.storage.from('voice-notes').createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) throw new Error('URL indisponible');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: data.signedUrl });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(st => {
        if (st.isLoaded && st.didJustFinish) {
          setState('idle');
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
      await sound.playAsync();
      setState('playing');
    } catch {
      setState('idle');
    }
  };

  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, isPlaying && styles.btnActive]}
        onPress={handleToggle}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ width: 22, height: 22 }} />
        ) : isPlaying ? (
          <IcoPause color={colors.bg} />
        ) : (
          <IcoPlay color={colors.accent} />
        )}
      </TouchableOpacity>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke={isPlaying ? colors.accent : colors.muted} />
        <Path d="M19 10a7 7 0 0 1-14 0" stroke={isPlaying ? colors.accent : colors.muted} />
        <Path d="M12 19v3M9 22h6" stroke={isPlaying ? colors.accent : colors.muted} />
      </Svg>
      <Text style={[styles.label, isPlaying && styles.labelActive]}>
        {isPlaying ? 'Message vocal...' : state === 'paused' ? 'Reprendre' : 'Message vocal client'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(253,207,52,.06)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.15)',
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  labelActive: {
    color: colors.accent,
  },
});
