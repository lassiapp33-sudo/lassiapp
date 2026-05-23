import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// Hauteurs des barres de la waveform (dp) — forme naturelle non uniforme
const WAVE_HEIGHTS = [
  8, 15, 22, 12, 18, 9, 20, 14, 7, 16,
  11, 19, 6, 13, 21, 10, 17, 8, 14, 20,
];

interface Props {
  sender:   'me' | 'them';
  duration: string;    // ex : "0:09"
  time:     string;
  read?:    boolean;
}

export default function BubbleVoice({ sender, duration, time, read }: Props) {
  const [playing, setPlaying] = useState(false);
  const isMe = sender === 'me';

  // Couleurs adaptées selon l'émetteur
  const bgColor      = isMe ? '#FDCF34' : '#222447';
  const playBg       = isMe ? 'rgba(20,21,42,.18)' : 'rgba(255,255,255,.12)';
  const playColor    = isMe ? colors.bg : colors.white;
  const barColor     = isMe ? 'rgba(20,21,42,.35)' : 'rgba(255,255,255,.3)';
  const durationColor = isMe ? colors.bg : colors.white;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        { backgroundColor: bgColor },
        isMe ? { borderBottomRightRadius: 5 } : { borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border },
      ]}>
        {/* Bouton play */}
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: playBg }]}
          onPress={() => setPlaying(v => !v)}
          activeOpacity={0.75}
        >
          {playing ? (
            // Icône pause
            <Svg width={14} height={14} viewBox="0 0 24 24" fill={playColor}>
              <Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={playColor} />
            </Svg>
          ) : (
            // Icône play
            <Svg width={14} height={14} viewBox="0 0 24 24" fill={playColor}>
              <Path d="M8 5v14l11-7z" fill={playColor} />
            </Svg>
          )}
        </TouchableOpacity>

        {/* Waveform — barres de hauteurs variables */}
        <View style={styles.wave}>
          {WAVE_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[styles.bar, { height: h, backgroundColor: barColor }]}
            />
          ))}
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
  row: { maxWidth: '85%' },
  rowMe:   { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    minWidth: 190,
  },

  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Zone waveform
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 24,
  },
  bar: {
    width: 2.5,
    borderRadius: 2,
  },

  duration: {
    fontFamily: fonts.title,
    fontSize: 11,
    flexShrink: 0,
  },

  time: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 9.5,
    marginTop: 4,
  },
  timeMe:   { marginRight: 3 },
  timeThem: { marginLeft: 3 },
});
