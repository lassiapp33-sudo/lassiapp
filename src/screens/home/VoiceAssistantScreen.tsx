import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.white} />
  </Svg>
);

const IcoMic = () => (
  <Svg width={36} height={36} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={colors.bg} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.bg} />
    <Path d="M12 19v3" stroke={colors.bg} />
  </Svg>
);

// ─── Exemples de phrases ──────────────────────────────────────────────────────

const EXAMPLES = [
  { highlight: 'coiffeur', rest: ' pour des tresses près de la ', highlight2: 'Patte d\'Oie', prefix: '« Trouve-moi un ', suffix: ' »' },
  { full: '« Boobu Tangana la gënë dëgër ci Grand Dakar ? »', wolof: true },
  { highlight: 'ciment', rest: ' disponible à ', highlight2: 'Rufisque', prefix: '« Qui a du ', suffix: ' ? »' },
];

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function VoiceAssistantScreen({ onClose }: Props) {
  // Deux anneaux pulsants, déphasés de 500ms
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = makePulse(ring1, 0);
    const a2 = makePulse(ring2, 600);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  const makeRingStyle = (anim: Animated.Value) => ({
    transform: [{
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.38] }),
    }],
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.65, 0] }),
  });

  return (
    <View style={styles.root}>
      {/* Bouton fermer */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: TOP_INSET + 6 }]}
        onPress={onClose}
        activeOpacity={0.75}
      >
        <IcoClose />
      </TouchableOpacity>

      {/* Label en-tête */}
      <Text style={[styles.label, { marginTop: TOP_INSET + 10 }]}>
        ✨ Assistant LASSİ
      </Text>

      {/* Espace flexible — pousse le micro vers le centre */}
      <View style={{ flex: 1 }} />

      {/* Micro + anneaux pulsants */}
      <View style={styles.micWrap}>
        {/* Anneau 1 */}
        <Animated.View style={[styles.ring, makeRingStyle(ring1)]} />
        {/* Anneau 2 */}
        <Animated.View style={[styles.ring, makeRingStyle(ring2)]} />
        {/* Cercle statique intermédiaire */}
        <View style={[styles.ring, styles.ringStatic]} />
        {/* Core jaune avec icône mic */}
        <View style={styles.core}>
          <IcoMic />
        </View>
      </View>

      {/* Titre + indicateur */}
      <Text style={styles.title}>Je t'écoute…</Text>

      <View style={styles.listeningRow}>
        <View style={styles.dot} />
        <Text style={styles.listeningTxt}>Parle en français ou en wolof</Text>
      </View>

      {/* Espace flexible bas */}
      <View style={{ flex: 1.6 }} />

      {/* Exemples de phrases */}
      <View style={styles.examples}>
        <Text style={styles.exLbl}>Essaie de dire :</Text>

        <View style={styles.exCard}>
          <Text style={styles.exTxt}>
            {'« Trouve-moi un '}
            <Text style={styles.exBold}>coiffeur</Text>
            {' pour des tresses près de la '}
            <Text style={styles.exBold}>Patte d'Oie</Text>
            {' »'}
          </Text>
        </View>

        <View style={styles.exCard}>
          <Text style={[styles.exTxt, styles.exWolof]}>
            {'« Boobu '}
            <Text style={styles.exBold}>Tangana</Text>
            {' la gënë dëgër ci '}
            <Text style={styles.exBold}>Grand Dakar</Text>
            {' ? »'}
          </Text>
        </View>

        <View style={styles.exCard}>
          <Text style={styles.exTxt}>
            {'« Qui a du '}
            <Text style={styles.exBold}>ciment</Text>
            {' disponible à '}
            <Text style={styles.exBold}>Rufisque</Text>
            {' ? »'}
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </View>
  );
}

const RING_SIZE = 150;
const CORE_SIZE = 84;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Micro
  micWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  ringStatic: {
    width: RING_SIZE - 52,
    height: RING_SIZE - 52,
    opacity: 0.4,
  },
  core: {
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  // Textes
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  listeningTxt: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  // Exemples
  examples: {
    width: '100%',
  },
  exLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },
  exCard: {
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 11,
    paddingHorizontal: 14,
    marginBottom: 9,
  },
  exTxt: {
    color: '#cfd0e0',
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  exWolof: {
    fontFamily: fonts.body,
  },
  exBold: {
    color: colors.white,
    fontFamily: fonts.ui,
  },
});
