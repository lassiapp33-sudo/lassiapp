import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts } from '../theme';

const SIZE = 240;

interface Props { onFinish: () => void; }

export default function SplashScreen({ onFinish }: Props) {
  const rotation   = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    // Rotation continue 360° linéaire — seule l'aiguille tourne
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Tagline : fondu + légère montée décalée
    Animated.parallel([
      Animated.timing(tagOpacity, {
        toValue: 1, duration: 700, delay: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tagY, {
        toValue: 0, duration: 700, delay: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onFinish, 2600);
    return () => clearTimeout(timer);
  }, [onFinish]);

  const rotate = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>

      <View style={styles.radarBox}>
        {/* Décor fixe : cercle pointillé + "L" + point jaune — ne bouge jamais */}
        <Image
          source={require('../../assets/icon/lassi-radar-base.png')}
          style={styles.layer}
        />
        {/* Aiguille seule par-dessus — tourne en boucle autour du centre */}
        <Animated.Image
          source={require('../../assets/icon/lassi-radar-aiguille.png')}
          style={[styles.layer, { transform: [{ rotate }] }]}
        />
      </View>

      <Animated.Text
        style={[
          styles.tagline,
          { opacity: tagOpacity, transform: [{ translateY: tagY }] },
        ]}
      >
        L'économie de ton quartier, dans ta poche
      </Animated.Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,   // #14152A — fond unique, plein écran
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  radarBox: {
    width: SIZE,
    height: SIZE,
  },
  layer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    resizeMode: 'contain',
  },
  tagline: {
    color: '#8a8eb5',
    fontFamily: fonts.title,
    fontSize: 16,
    marginTop: 44,
  },
});
