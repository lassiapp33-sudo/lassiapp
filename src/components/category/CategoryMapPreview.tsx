import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Polygon } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

interface Props {
  categoryLabel: string;
  subLabel?: string;
  onPress: () => void;
}

function MapIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice">
      {/* Fond */}
      <Rect x={0} y={0} width={320} height={120} fill="#0E1628" />

      {/* Routes principales */}
      <Line x1={0} y1={60} x2={320} y2={60} stroke="#1E2D4A" strokeWidth={12} />
      <Line x1={160} y1={0} x2={160} y2={120} stroke="#1E2D4A" strokeWidth={8} />
      <Line x1={0} y1={20} x2={200} y2={90} stroke="#192340" strokeWidth={6} />
      <Line x1={100} y1={0} x2={320} y2={110} stroke="#192340" strokeWidth={6} />

      {/* Routes secondaires */}
      <Line x1={0} y1={90} x2={140} y2={30} stroke="#16203A" strokeWidth={3} />
      <Line x1={220} y1={0} x2={320} y2={60} stroke="#16203A" strokeWidth={3} />
      <Line x1={0} y1={40} x2={320} y2={80} stroke="#16203A" strokeWidth={2} />

      {/* Blocs bâtiments */}
      <Rect x={10} y={10} width={40} height={25} rx={2} fill="#152038" />
      <Rect x={60} y={70} width={30} height={20} rx={2} fill="#152038" />
      <Rect x={200} y={10} width={50} height={30} rx={2} fill="#152038" />
      <Rect x={240} y={75} width={35} height={22} rx={2} fill="#152038" />
      <Rect x={10} y={80} width={25} height={28} rx={2} fill="#152038" />
      <Rect x={270} y={10} width={42} height={20} rx={2} fill="#152038" />

      {/* Pins secondaires */}
      <Circle cx={80} cy={35} r={5} fill="#FDCF34" opacity={0.4} />
      <Circle cx={250} cy={85} r={4} fill="#FDCF34" opacity={0.35} />
      <Circle cx={30} cy={95} r={4} fill="#FDCF34" opacity={0.3} />
      <Circle cx={290} cy={45} r={5} fill="#FDCF34" opacity={0.4} />

      {/* Pin principal au centre */}
      <Path
        d="M160 28 C151 28 144 35 144 44 C144 56 160 72 160 72 C160 72 176 56 176 44 C176 35 169 28 160 28 Z"
        fill={colors.accent}
      />
      <Circle cx={160} cy={44} r={7} fill="#14152A" />

      {/* Cercle pulse autour du pin */}
      <Circle cx={160} cy={50} r={20} fill={colors.accent} opacity={0.08} />
      <Circle cx={160} cy={50} r={14} fill={colors.accent} opacity={0.1} />
    </Svg>
  );
}

export default function CategoryMapPreview({ categoryLabel, subLabel, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
      {/* Illustration carte */}
      <View style={styles.mapArea}>
        <MapIllustration />
        {/* Overlay dégradé bas */}
        <View style={styles.overlay} />
      </View>

      {/* Bandeau inférieur */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.pinDot} />
          <Text style={styles.label} numberOfLines={1}>
            {subLabel ? `${categoryLabel} · ${subLabel}` : categoryLabel}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaTxt}>Voir sur la carte</Text>
          <Text style={styles.arrow}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(253, 207, 52, 0.2)',
    backgroundColor: '#0E1628',
  },
  mapArea: {
    height: 120,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(20, 21, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(253, 207, 52, 0.12)',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ctaTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  arrow: {
    color: colors.accent,
    fontSize: 16,
    fontFamily: fonts.title,
    lineHeight: 18,
  },
});
