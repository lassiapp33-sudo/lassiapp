import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../../theme';

interface Props {
  // Passe require('../../assets/audio/partage_wolof.mp3') ou { uri: '...' }
  // Si null → bouton visible mais lecture silencieuse
  audioSource?: Parameters<typeof Audio.Sound.createAsync>[0] | null;
  bottomOffset?: number; // espace au-dessus de la nav bar
}

export default function AudioFloatingButton({
  audioSource = null,
  bottomOffset = 90,
}: Props) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Saut rebondissant + délai naturel
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(bounceAnim, {
          toValue: -12,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: -6,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [bounceAnim]);

  // Halo pulse en continu
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.85,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(200),
      ]),
    ).start();
  }, [pulseScale, pulseOpacity]);

  // Nettoyage son
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const handlePress = async () => {
    if (!audioSource) return;

    if (playing) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
      return;
    }

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(audioSource, {
        shouldPlay: true,
      });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      // audio pas encore disponible
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: bottomOffset }]}
    >
      {/* Label au-dessus */}
      <View style={styles.labelBubble}>
        <Text style={styles.labelText}>
          {playing ? 'En lecture...' : 'Écoute le message'}
        </Text>
        {/* Petite flèche pointant vers le bas */}
        <View style={styles.labelArrow} />
      </View>

      {/* Bouton + halo */}
      <Animated.View
        style={[styles.animContainer, { transform: [{ translateY: bounceAnim }] }]}
      >
        {/* Halo pulse */}
        <Animated.View
          style={[
            styles.halo,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={handlePress}
          activeOpacity={0.82}
        >
          {playing ? (
            <View style={styles.pauseWrap}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <View style={styles.playTriangle} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const FAB_SIZE = 62;
const HALO_SIZE = FAB_SIZE;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  labelBubble: {
    backgroundColor: colors.bg,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
    alignItems: 'center',
  },
  labelText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  labelArrow: {
    position: 'absolute',
    bottom: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.accent,
  },
  animContainer: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.accent,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 19,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bg,
    marginLeft: 4,
  },
  pauseWrap: {
    flexDirection: 'row',
    gap: 5,
  },
  pauseBar: {
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: colors.bg,
  },
});
