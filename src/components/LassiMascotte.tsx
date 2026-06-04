import React, { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

export const MASCOTTE_NOM = 'Lassi';

export type MascotteForme = 'welcome' | 'support' | 'explorer' | 'search';
export type MascotteAnim = 'auto' | 'peek' | 'beat' | 'fly' | 'jelly' | 'none';
type AnimResolved = Exclude<MascotteAnim, 'auto'>;

const FORME_ANIM: Record<MascotteForme, AnimResolved> = {
  welcome: 'peek',
  support: 'beat',
  explorer: 'fly',
  search: 'jelly',
};

const SOURCES: Record<MascotteForme, ReturnType<typeof require>> = {
  welcome: require('../../assets/mascotte/lassi-welcome.png'),
  support: require('../../assets/mascotte/lassi-support.png'),
  explorer: require('../../assets/mascotte/lassi-explorer.png'),
  search: require('../../assets/mascotte/lassi-search.png'),
};

export function getMascotteSource(forme: MascotteForme) {
  return SOURCES[forme];
}

export interface LassiMascotteProps {
  forme?: MascotteForme;
  taille?: number;
  animation?: MascotteAnim;
  glow?: boolean;
  boucle?: boolean;
  actif?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function LassiMascotte({
  forme = 'welcome',
  taille = 120,
  animation = 'auto',
  glow = true,
  boucle = true,
  actif = true,
  onPress,
  style,
}: LassiMascotteProps) {
  const anim: AnimResolved = animation === 'auto' ? FORME_ANIM[forme] : (animation as AnimResolved);

  // ── Animated.Value (React Native natif — aucune dépendance JSI/worklet) ────
  const translateY = useRef(new Animated.Value(anim === 'peek' ? 90 : 0)).current;
  const translateX = useRef(new Animated.Value(anim === 'fly' ? -52 : 0)).current;
  const scale = useRef(new Animated.Value(anim === 'peek' ? 0.8 : 1)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(anim === 'peek' ? 0 : 1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const glowSc = useRef(new Animated.Value(0.85)).current;
  const glowOp = useRef(new Animated.Value(glow ? 0.15 : 0)).current;

  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnim = useRef<Animated.CompositeAnimation | null>(null);
  const reducedRef = useRef(false);

  // ── Reduced motion (AccessibilityInfo — pur React Native) ────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      reducedRef.current = v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      reducedRef.current = v;
    });
    return () => sub.remove();
  }, []);

  // ── Glow pulse ────────────────────────────────────────────────────────────
  useEffect(() => {
    glowAnim.current?.stop();
    if (!glow || !actif) {
      glowSc.setValue(1);
      glowOp.setValue(glow ? 0.25 : 0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowSc, {
            toValue: 1.12,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOp, {
            toValue: 0.42,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowSc, {
            toValue: 0.85,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOp, {
            toValue: 0.15,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    glowAnim.current = loop;
    loop.start();
    return () => loop.stop();
  }, [glow, actif]);

  // ── Animation principale ──────────────────────────────────────────────────
  useEffect(() => {
    animRef.current?.stop();

    translateY.setValue(0);
    translateX.setValue(0);
    scale.setValue(1);
    scaleX.setValue(1);
    scaleY.setValue(1);

    if (anim === 'none' || !actif) {
      opacity.setValue(1);
      return;
    }

    let main: Animated.CompositeAnimation;

    // ── PEEK ─────────────────────────────────────────────────────────────────
    if (anim === 'peek') {
      translateY.setValue(90);
      scale.setValue(0.8);
      opacity.setValue(0);

      const enter = Animated.parallel([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 380,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(scale, { toValue: 1.06, duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]);
      const settle = Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]);
      const exit = Animated.parallel([
        Animated.timing(translateY, { toValue: 90, duration: 820, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: 820, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 820, useNativeDriver: true }),
      ]);

      if (boucle) {
        main = Animated.loop(Animated.sequence([enter, settle, Animated.delay(1800), exit]));
      } else {
        main = Animated.sequence([enter, settle]);
      }

      // ── BEAT ─────────────────────────────────────────────────────────────────
    } else if (anim === 'beat') {
      opacity.setValue(1);
      const cycle = Animated.sequence([
        Animated.timing(scale, { toValue: 1.16, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.1, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(880),
      ]);
      main = boucle ? Animated.loop(cycle) : cycle;

      // ── FLY ──────────────────────────────────────────────────────────────────
    } else if (anim === 'fly') {
      opacity.setValue(1);
      translateX.setValue(-52);
      scaleX.setValue(1);
      const DUR = 1600;

      const flyX = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 52,
            duration: DUR,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -52,
            duration: DUR,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        boucle ? undefined : { iterations: 1 },
      );
      const flipX = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleX, { toValue: 1, duration: DUR - 16, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: -1, duration: 16, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: -1, duration: DUR - 16, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: 1, duration: 16, useNativeDriver: true }),
        ]),
        boucle ? undefined : { iterations: 1 },
      );
      const flyY = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        boucle ? undefined : { iterations: 1 },
      );
      main = Animated.parallel([flyX, flipX, flyY]);

      // ── JELLY ─────────────────────────────────────────────────────────────────
    } else {
      opacity.setValue(1);
      const jellyY = Animated.sequence([
        Animated.delay(60),
        Animated.timing(translateY, {
          toValue: -38,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, { toValue: -9, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.delay(620),
      ]);
      const jX = Animated.sequence([
        Animated.delay(60),
        Animated.timing(scaleX, { toValue: 0.9, duration: 280, useNativeDriver: true }),
        Animated.timing(scaleX, { toValue: 1.13, duration: 220, useNativeDriver: true }),
        Animated.timing(scaleX, { toValue: 0.97, duration: 160, useNativeDriver: true }),
        Animated.timing(scaleX, { toValue: 1.04, duration: 160, useNativeDriver: true }),
        Animated.timing(scaleX, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]);
      const jY = Animated.sequence([
        Animated.delay(60),
        Animated.timing(scaleY, { toValue: 1.13, duration: 280, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 0.85, duration: 220, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1.04, duration: 160, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 0.97, duration: 160, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]);
      const cycle = Animated.parallel([jellyY, jX, jY]);
      main = boucle ? Animated.loop(cycle) : cycle;
    }

    animRef.current = main;
    main.start();
    return () => main.stop();
  }, [anim, boucle, actif]);

  // ── Effet au toucher ──────────────────────────────────────────────────────
  const handlePressIn = useCallback(() => {
    Animated.timing(pressScale, { toValue: 0.92, duration: 80, useNativeDriver: true }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();
  }, []);

  // ── Éléments ──────────────────────────────────────────────────────────────
  const imgH = taille * 1.27;
  const glowSize = taille * 0.82;

  const glowEl = glow ? (
    <Animated.View
      style={{
        position: 'absolute',
        top: (imgH - glowSize) / 2,
        left: (taille - glowSize) / 2,
        width: glowSize,
        height: glowSize,
        borderRadius: glowSize / 2,
        backgroundColor: '#FDCF34',
        opacity: glowOp,
        transform: [{ scale: glowSc }],
      }}
    />
  ) : null;

  const img = (
    <Image
      source={getMascotteSource(forme)}
      style={{ width: taille, height: imgH }}
      resizeMode="contain"
    />
  );

  // Style animé principal (opacity + transforms de la mascotte)
  const mascotteAnimStyle = {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: taille,
    opacity,
    transform: [{ translateY }, { translateX }, { scale }, { scaleX }, { scaleY }],
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (onPress) {
    return (
      <Pressable style={style} onPress={onPress}>
        {/* Wrapper press-scale séparé pour ne pas interférer avec les animations */}
        <Animated.View
          style={{ transform: [{ scale: pressScale }] }}
          onTouchStart={handlePressIn}
          onTouchEnd={handlePressOut}
        >
          <Animated.View style={mascotteAnimStyle}>
            {glowEl}
            {img}
          </Animated.View>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Animated.View style={[style, mascotteAnimStyle]}>
      {glowEl}
      {img}
    </Animated.View>
  );
}
