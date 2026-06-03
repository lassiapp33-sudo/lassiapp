import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  type ViewToken,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, spacing } from '../theme';
import LassiLogo from '../components/LassiLogo';
import { LassiMascotte } from '../components/LassiMascotte';

// LayoutAnimation Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const { width } = Dimensions.get('window');

interface Slide {
  key: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

// Icones SVG de chaque slide (taille 74×74, trait jaune)
const IconLocation = () => (
  <Svg width={74} height={74} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Circle cx={12} cy={10} r={3} stroke={colors.accent} />
  </Svg>
);

const IconChat = () => (
  <Svg width={74} height={74} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
      stroke={colors.accent}
    />
    <Rect x={10.4} y={7} width={3.2} height={5.2} rx={1.6} stroke={colors.accent} />
    <Path d="M9 12.5a3 3 0 0 0 6 0" stroke={colors.accent} />
  </Svg>
);

const IconBook = () => (
  <Svg width={74} height={74} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"   stroke={colors.accent} />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" stroke={colors.accent} />
    <Path
      d="M12 6.1l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z"
      fill={colors.accent}
    />
  </Svg>
);

const SLIDES: Slide[] = [
  {
    key: 'discover',
    icon: <IconLocation />,
    title: 'Tout ton quartier,\nen un flash',
    desc: 'Trouve instantanément les boutiques, tanganas, coiffeurs et restos autour de toi.',
  },
  {
    key: 'order',
    icon: <IconChat />,
    title: 'Commande en parlant,\npaie en 1 clic',
    desc: 'Discute avec tes commerçants, envoie un vocal, et règle directement via Wave ou Orange Money.',
  },
  {
    key: 'business',
    icon: <IconBook />,
    title: 'Gère ton business\ncomme un pro',
    desc: 'Cahier de dettes numérique, relances automatiques et visibilité Top 3 dans ton quartier.',
  },
];

interface Props {
  onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCurrentIndex(idx);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onFinish();
    }
  };

  const skipToLast = () => {
    flatListRef.current?.scrollToIndex({ index: SLIDES.length - 1, animated: true });
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Mini logo haut gauche */}
      <View style={styles.miniLogo}>
        <LassiLogo width={92} />
      </View>

      {/* Bouton Passer */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={skipToLast} activeOpacity={0.7}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Slides swipables */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            {/* Carte illustration — mascotte sur le premier slide */}
            <View style={[styles.illusCard, index === 0 && styles.illusCardMascotte]}>
              {index === 0 ? (
                <LassiMascotte
                  forme="welcome"
                  taille={120}
                  actif={currentIndex === 0}
                />
              ) : (
                item.icon
              )}
            </View>

            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Zone bas : dots + bouton */}
      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLast ? 'Commencer' : 'Suivant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  miniLogo: {
    position: 'absolute',
    top: 50,
    left: spacing.screen,
    zIndex: 10,
    opacity: 0.9,
  },

  skipBtn: {
    position: 'absolute',
    top: 54,
    right: spacing.screen,
    zIndex: 10,
  },
  skipText: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 14,
  },

  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    paddingTop: 110,
    paddingHorizontal: spacing.screen + 4,
  },

  illusCard: {
    marginTop: 20,
    width: 172,
    height: 172,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  // Premier slide : fond transparent pour laisser la mascotte respirer
  illusCardMascotte: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },

  slideTitle: {
    marginTop: 44,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 25,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  slideDesc: {
    marginTop: 14,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },

  bottom: {
    paddingHorizontal: spacing.screen + 4,
    paddingBottom: 38,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginBottom: 22,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 26,
    backgroundColor: colors.accent,
  },

  cta: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
