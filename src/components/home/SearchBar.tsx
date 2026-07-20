import React, { useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { IcoSearch } from '../icons';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onMicPress?: () => void;
  onPress?: () => void; // si fourni → barre en lecture seule, appui navigue vers SearchScreen
}

const IcoTrophy = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 2h12v9a6 6 0 0 1-12 0V2z" stroke={colors.bg} />
    <Path d="M4 4H6M18 4h2v3a2 2 0 0 1-2 2" stroke={colors.bg} />
    <Path d="M6 4H4v3a2 2 0 0 0 2 2" stroke={colors.bg} />
    <Path d="M12 17v4" stroke={colors.bg} />
    <Path d="M8 21h8" stroke={colors.bg} />
  </Svg>
);

export default function SearchBar({ value, onChangeText, onMicPress, onPress }: Props) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        // Phase 1 : expansion + fondu
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.4,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // Phase 2 : reset instantané pour la prochaine boucle
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(600),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.row}>
      {/* Champ de recherche — appuyable si onPress est fourni */}
      <TouchableOpacity style={styles.search} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
        <IcoSearch />
        <TextInput
          style={styles.input}
          placeholder="Cherche un commerce, un plat…"
          placeholderTextColor="#5a5c80"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          editable={!onPress}
          pointerEvents={onPress ? 'none' : 'auto'}
        />
      </TouchableOpacity>

      {/* Bouton micro IA avec ring pulsant */}
      <View style={styles.micWrap}>
        <Animated.View
          style={[styles.ring, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
        />
        <TouchableOpacity style={styles.mic} onPress={onMicPress} activeOpacity={0.85}>
          <IcoTrophy />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const MIC_SIZE = 52;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  search: {
    flex: 1,
    height: MIC_SIZE,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  micWrap: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ring pulsant positionné derrière le bouton
  ring: {
    position: 'absolute',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  mic: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
