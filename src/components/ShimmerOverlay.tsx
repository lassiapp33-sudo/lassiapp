import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface Props {
  width: number;
}

// Reflet doré diagonal en boucle (sweep rapide puis retour lent hors-champ).
export default function ShimmerOverlay({ width }: Props) {
  const sheenX = useRef(new Animated.Value(-width * 1.2)).current;

  useEffect(() => {
    sheenX.setValue(-width * 1.2);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sheenX, {
          toValue: width * 1.5,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheenX, {
          toValue: -width * 1.2,
          duration: 2900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [sheenX, width]);

  return (
    <View style={[styles.clip, { width }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.bar,
          {
            height: width * 3,
            top: -width,
            transform: [{ translateX: sheenX }, { rotate: '18deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    width: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
