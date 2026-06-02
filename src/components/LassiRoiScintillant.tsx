/**
 * LassiRoiScintillant — mascotte abeille ROI avec animation "Scintillement royal" :
 *   1. Respiration douce (scale 1 ↔ 1.06)
 *   2. Reflet doré diagonal qui balaie la mascotte de temps en temps
 *   3. Étincelles de couronne : 4 étoiles dorées clignotantes en décalé
 *
 * Utilise Animated natif (useNativeDriver: true) — pas de reanimated requis.
 * Passer actif={false} stoppe toutes les animations (économie de batterie).
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';

const OR = '#FDCF34';

// ── Étincelle ────────────────────────────────────────────────────────────────

interface SparkleProps {
  top?:    number;
  left?:   number;
  right?:  number;
  delay:   number;
  actif:   boolean;
  cycleMs: number;
}

function Sparkle({ top, left, right, delay, actif, cycleMs }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const sc      = useRef(new Animated.Value(0.3)).current;
  const anim    = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    anim.current?.stop();
    if (!actif) { opacity.setValue(0); return; }
    anim.current = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1,   duration: 600, useNativeDriver: true }),
          Animated.timing(sc,      { toValue: 1.1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0,   duration: 600, useNativeDriver: true }),
          Animated.timing(sc,      { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]),
        Animated.delay(Math.max(0, cycleMs - delay - 1200)),
      ]),
    );
    anim.current.start();
    return () => { anim.current?.stop(); };
  }, [actif]);

  return (
    <Animated.Text
      style={[styles.spark, { top, left, right, opacity, transform: [{ scale: sc }] }]}
    >
      ✦
    </Animated.Text>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  size?:  number;
  actif?: boolean;
}

export default function LassiRoiScintillant({ size = 190, actif = true }: Props) {
  const breath     = useRef(new Animated.Value(1)).current;
  const sheenX     = useRef(new Animated.Value(-size * 1.2)).current;
  const breathAnim = useRef<Animated.CompositeAnimation | null>(null);
  const sheenAnim  = useRef<Animated.CompositeAnimation | null>(null);

  // Respiration
  useEffect(() => {
    breathAnim.current?.stop();
    if (!actif) { breath.setValue(1); return; }
    breathAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1.06, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1.0,  duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathAnim.current.start();
    return () => { breathAnim.current?.stop(); };
  }, [actif]);

  // Reflet doré : traverse rapidement, revient lentement hors-champ
  useEffect(() => {
    sheenAnim.current?.stop();
    sheenX.setValue(-size * 1.2);
    if (!actif) return;
    sheenAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(sheenX, { toValue:  size * 1.5,  duration: 700,  easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sheenX, { toValue: -size * 1.2,  duration: 2900, easing: Easing.linear,              useNativeDriver: true }),
      ]),
    );
    sheenAnim.current.start();
    return () => { sheenAnim.current?.stop(); };
  }, [actif]);

  const CYCLE = 3600;

  return (
    <View style={{ width: size + 70, height: size + 90, alignItems: 'center', justifyContent: 'center' }}>

      {/* Étincelles autour de la couronne (positions calées sur l'image roi) */}
      <Sparkle top={14} left={40}  delay={100}  actif={actif} cycleMs={CYCLE} />
      <Sparkle top={20} left={110} delay={400}  actif={actif} cycleMs={CYCLE} />
      <Sparkle top={28} right={36} delay={1000} actif={actif} cycleMs={CYCLE} />
      <Sparkle top={60} left={26}  delay={1700} actif={actif} cycleMs={CYCLE} />

      {/* Mascotte qui respire + reflet clippé sur sa zone */}
      <Animated.View style={{ transform: [{ scale: breath }] }}>
        <Image
          source={require('../../assets/mascotte/lassi-roi.png')}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />

        {/* Reflet diagonal clippé à la zone de l'image */}
        <View style={[styles.sheenClip, { width: size, height: size }]} pointerEvents="none">
          <Animated.View
            style={[
              styles.sheenBar,
              { height: size * 2, transform: [{ translateX: sheenX }, { rotate: '18deg' }] },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    color: OR,
    fontSize: 18,
    zIndex: 5,
    textShadowColor: 'rgba(253,207,52,0.8)',
    textShadowRadius: 8,
  },
  sheenClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 4,
  },
  sheenBar: {
    position: 'absolute',
    width: 36,
    top: -60,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
});
