import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { colors, fonts } from '../../theme';

// Hauteurs des barres de la waveform (dp) — forme naturelle
const WAVE_HEIGHTS = [
  8, 15, 22, 12, 18, 9, 20, 14, 7, 16,
  11, 19, 6, 13, 21, 10, 17, 8, 14, 20,
];

interface Props {
  sender:    'me' | 'them';
  duration:  string;         // ex : "0:09"
  voiceUrl?: string | null;  // URL Supabase Storage
  time:      string;
  read?:     boolean;
}

export default function BubbleVoice({ sender, duration, voiceUrl, time, read }: Props) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);  // 0→1
  const soundRef = useRef<Audio.Sound | null>(null);

  const isMe = sender === 'me';
  const bgColor      = isMe ? '#FDCF34' : '#222447';
  const playBg       = isMe ? 'rgba(20,21,42,.18)' : 'rgba(255,255,255,.12)';
  const playColor    = isMe ? colors.bg : colors.white;
  const barActive    = isMe ? 'rgba(20,21,42,.75)' : 'rgba(255,255,255,.9)';
  const barInactive  = isMe ? 'rgba(20,21,42,.28)' : 'rgba(255,255,255,.25)';
  const durationColor = isMe ? colors.bg : colors.white;

  // ── Nettoyage du son à la destruction du composant ───────────────────────
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Callback de suivi de la lecture ──────────────────────────────────────
  const onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      setPlaying(false);
      setProgress(0);
      soundRef.current?.setPositionAsync(0).catch(() => {});
      return;
    }
    if (status.durationMillis && status.durationMillis > 0) {
      setProgress(status.positionMillis / status.durationMillis);
    }
  }, []);

  // ── Lecture / Pause ───────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    if (!voiceUrl) return;

    try {
      if (playing) {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
        return;
      }

      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS:   false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: voiceUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 100 },
          onPlaybackStatus,
        );
        soundRef.current = sound;
      } else {
        soundRef.current.setOnPlaybackStatusUpdate(onPlaybackStatus);
        await soundRef.current.playAsync();
      }

      setPlaying(true);
    } catch (err) {
      console.warn('[BubbleVoice] togglePlay:', err);
    }
  }, [playing, voiceUrl, onPlaybackStatus]);

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        { backgroundColor: bgColor },
        isMe
          ? { borderBottomRightRadius: 5 }
          : { borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border },
      ]}>

        {/* Bouton play/pause */}
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: playBg }]}
          onPress={togglePlay}
          activeOpacity={0.75}
          disabled={!voiceUrl}
        >
          {playing ? (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={playColor} />
            </Svg>
          ) : (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M8 5v14l11-7z" fill={playColor} />
            </Svg>
          )}
        </TouchableOpacity>

        {/* Waveform avec progression colorée */}
        <View style={styles.wave}>
          {WAVE_HEIGHTS.map((h, i) => {
            const barRatio = i / (WAVE_HEIGHTS.length - 1);
            const played   = barRatio <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: h, backgroundColor: played ? barActive : barInactive },
                ]}
              />
            );
          })}
        </View>

        {/* Durée */}
        <Text style={[styles.duration, { color: durationColor }]}>{duration}</Text>
      </View>

      <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem]}>
        {time}{isMe && read ? ' ✓✓' : isMe ? ' ✓' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { maxWidth: '85%' },
  rowMe:    { alignSelf: 'flex-end',   alignItems: 'flex-end'   },
  rowThem:  { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingVertical:  9,
    paddingHorizontal: 13,
    borderRadius:     18,
    minWidth:         190,
  },

  playBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  wave: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2.5,
    height:        24,
  },

  bar: {
    width:        2.5,
    borderRadius: 2,
  },

  duration: {
    fontFamily: fonts.title,
    fontSize:   11,
    flexShrink: 0,
  },

  time: {
    color:      '#5a5c80',
    fontFamily: fonts.body,
    fontSize:   9.5,
    marginTop:  4,
  },
  timeMe:   { marginRight: 3 },
  timeThem: { marginLeft:  3 },
});
