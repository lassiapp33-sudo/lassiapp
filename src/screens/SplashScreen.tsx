import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Animated, Easing,
} from 'react-native';
import Svg, { Circle, Rect, Line, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SIZE = Math.min(SCREEN_W * 0.62, 248);

// ─── Géométrie (viewBox 200×200, centre 100,100) ──────────────────────────────

const CX = 100, CY = 100;
const R  = 74;
const TO_RAD = Math.PI / 180;

// Aiguille : ~10° à droite du nord = –80° depuis l'axe X positif
const NEEDLE_A = -80 * TO_RAD;
const NX = +(CX + R * Math.cos(NEEDLE_A)).toFixed(1);   // ≈ 112.8
const NY = +(CY + R * Math.sin(NEEDLE_A)).toFixed(1);   // ≈  27.1

// Bord arrière du faisceau : –7° depuis +X  (secteur ≈ 73°)
const TRAIL_A = -7 * TO_RAD;
const TX = +(CX + R * Math.cos(TRAIL_A)).toFixed(1);    // ≈ 173.4
const TY = +(CY + R * Math.sin(TRAIL_A)).toFixed(1);    // ≈  90.0

// Chemin SVG du secteur
const SECTOR = `M ${CX} ${CY} L ${NX} ${NY} A ${R} ${R} 0 0 1 ${TX} ${TY} Z`;

// Blip FIXE : dans le secteur (mi-angle entre aiguille –80° et bord –7°),
// à 38% du rayon → correspond visuellement à l'icône PDF.
const BLIP_ANGLE = -43 * TO_RAD;
const BLIP_FRAC  = 0.38;
const BX = CX + R * BLIP_FRAC * Math.cos(BLIP_ANGLE);  // ≈ 120.6
const BY = CY + R * BLIP_FRAC * Math.sin(BLIP_ANGLE);  // ≈  80.3
const BLIP = 16;

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props { onFinish: () => void; }

export default function SplashScreen({ onFinish }: Props) {
  const rotation  = useRef(new Animated.Value(0)).current;
  const blipBlink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // ① Faisceau radar — rotation continue 360° / 3s
    const radarAnim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // ② Blip — clignotement (flash rapide → fondu lent, style radar)
    const blinkAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(blipBlink, { toValue: 0.08, duration: 400, useNativeDriver: true }),
        Animated.timing(blipBlink, { toValue: 1,    duration: 400, useNativeDriver: true }),
      ])
    );

    radarAnim.start();
    blinkAnim.start();

    const timer = setTimeout(onFinish, 2600);
    return () => {
      clearTimeout(timer);
      radarAnim.stop();
      blinkAnim.stop();
    };
  }, [onFinish]);

  const rotate = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>

      {/* ── Icône ────────────────────────────────────────────────────────── */}
      <View style={{ width: SIZE, height: SIZE }}>

        {/* ① FIXES : cercle pointillé + lettre L */}
        <Svg
          viewBox="0 0 200 200"
          width={SIZE} height={SIZE}
          style={StyleSheet.absoluteFill}
        >
          <Circle
            cx={CX} cy={CY} r={R}
            stroke="#C9A227"
            strokeWidth={5}
            strokeDasharray="8 7"
            strokeLinecap="round"
            fill="none"
          />
          {/* L — barre verticale */}
          <Rect x={68} y={60} width={12} height={64} rx={3} fill="white" />
          {/* L — pied horizontal (léger espace avec la barre) */}
          <Rect x={68} y={127} width={58} height={12} rx={3} fill="white" />
        </Svg>

        {/* ② TOURNANT : secteur sombre + aiguille (SANS le blip) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { width: SIZE, height: SIZE, transform: [{ rotate }] },
          ]}
        >
          <Svg viewBox="0 0 200 200" width={SIZE} height={SIZE}>
            <Path d={SECTOR} fill="rgba(30,32,58,0.85)" />
            <Line
              x1={CX} y1={CY}
              x2={NX} y2={NY}
              stroke="#FDCF34"
              strokeWidth={6}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        {/* ③ FIXE + CLIGNOTANT : carré signature jaune */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { width: SIZE, height: SIZE, opacity: blipBlink },
          ]}
        >
          <Svg viewBox="0 0 200 200" width={SIZE} height={SIZE}>
            <Rect
              x={BX - BLIP / 2} y={BY - BLIP / 2}
              width={BLIP} height={BLIP}
              rx={4}
              fill="#FDCF34"
            />
          </Svg>
        </Animated.View>

      </View>

      {/* ── Slogan ───────────────────────────────────────────────────────── */}
      <Text style={styles.slogan}>
        L'économie de ton quartier, dans ta poche
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  slogan: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 12,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.65,
  },
});
