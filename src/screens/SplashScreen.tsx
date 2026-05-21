import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, fonts } from '../theme';
import LassiLogo from '../components/LassiLogo';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  // Animations du logo (scale + opacité)
  const logoScale   = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Slogan fade-up
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const sloganY       = useRef(new Animated.Value(8)).current;

  // 3 points de chargement (bounce indépendants)
  const dot1Y = useRef(new Animated.Value(0)).current;
  const dot2Y = useRef(new Animated.Value(0)).current;
  const dot3Y = useRef(new Animated.Value(0)).current;
  const dot1O = useRef(new Animated.Value(0.5)).current;
  const dot2O = useRef(new Animated.Value(0.5)).current;
  const dot3O = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Logo apparaît
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1, friction: 8, tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Slogan fade-up après 350ms — fondu à 0.65 (peu claire)
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(sloganOpacity, {
          toValue: 0.65, duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(sloganY, {
          toValue: 0, duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Dots bounce loop (délais décalés : 0 / 200 / 400ms)
    const makeBounce = (y: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(y, { toValue: -9, duration: 280, useNativeDriver: true }),
            Animated.timing(o, { toValue: 1,  duration: 280, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(y, { toValue: 0,   duration: 280, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0.5, duration: 280, useNativeDriver: true }),
          ]),
          Animated.delay(440),
        ])
      );

    const b1 = makeBounce(dot1Y, dot1O, 0);
    const b2 = makeBounce(dot2Y, dot2O, 200);
    const b3 = makeBounce(dot3Y, dot3O, 400);
    b1.start(); b2.start(); b3.start();

    // Transition vers l'onboarding après 2.6s
    const timer = setTimeout(onFinish, 2600);
    return () => { clearTimeout(timer); b1.stop(); b2.stop(); b3.stop(); };
  }, [onFinish]);

  return (
    <View style={styles.container}>
      {/* Halo lumineux derrière le logo */}
      <View style={styles.glow} />

      {/* Logo animé */}
      <Animated.View
        style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
      >
        <LassiLogo width={width * 0.56} />
      </Animated.View>

      {/* Slogan */}
      <Animated.Text
        style={[
          styles.slogan,
          { opacity: sloganOpacity, transform: [{ translateY: sloganY }] },
        ]}
      >
        L'économie de ton quartier, dans ta poche
      </Animated.Text>

      {/* 3 points de chargement */}
      <View style={styles.loader}>
        {[
          { y: dot1Y, o: dot1O },
          { y: dot2Y, o: dot2O },
          { y: dot3Y, o: dot3O },
        ].map(({ y, o }, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: y }], opacity: o }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cercle centré exactement autour du logo + slogan
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(253, 207, 52, 0.08)',
    alignSelf: 'center',
    top: '50%',
    transform: [{ translateY: -130 }],
  },
  slogan: {
    marginTop: 18,
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 9,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loader: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
