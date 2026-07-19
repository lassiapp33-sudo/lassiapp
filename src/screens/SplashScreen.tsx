import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts } from '../theme';

const SIZE = 240;
const NEEDLE_LEN = Math.round(SIZE * 0.40);
const NEEDLE_W   = 8;

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY       = useRef(new Animated.Value(14)).current;
  const loopRef    = useRef<Animated.CompositeAnimation | null>(null);

  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue:         1,
        duration:        3000,
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
    );
    loopRef.current = loop;
    loop.start();

    Animated.parallel([
      Animated.timing(tagOpacity, {
        toValue: 1, duration: 700, delay: 500,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.timing(tagY, {
        toValue: 0, duration: 700, delay: 500,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => onFinishRef.current(), 2600);
    return () => {
      clearTimeout(timer);
      loopRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.radarBox}>
        {/* Décor fixe : cercle pointillé + L + point jaune */}
        <Image
          source={require('../../assets/icon/lassi-radar-base.png')}
          style={styles.layer}
        />
        {/* Aiguille dessinée en View — évite tout bug PNG/Animated.Image sur Android */}
        <Animated.View style={[styles.layer, { transform: [{ rotate }] }]}>
          <View style={styles.needle} />
        </Animated.View>
      </View>

      <Animated.Text
        style={[styles.tagline, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}
      >
        Ton quartier dans ta poche
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             36,
  },
  radarBox: {
    width:  SIZE,
    height: SIZE,
  },
  layer: {
    position:   'absolute',
    width:      SIZE,
    height:     SIZE,
    resizeMode: 'contain',
  },
  // Aiguille : rectangle jaune arrondi, pivot en bas au centre du radarBox
  needle: {
    position:        'absolute',
    width:           NEEDLE_W,
    height:          NEEDLE_LEN,
    backgroundColor: '#FDCF34',
    borderRadius:    NEEDLE_W / 2,
    left:            SIZE / 2 - NEEDLE_W / 2,
    top:             SIZE / 2 - NEEDLE_LEN,
  },
  tagline: {
    color:      '#8a8eb5',
    fontFamily: fonts.title,
    fontSize:   22,
    marginTop:  44,
  },
});
