import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Poppins_300Light } from '@expo-google-fonts/poppins';

import { colors } from './src/theme';
import SplashScreen       from './src/screens/SplashScreen';
import OnboardingScreen   from './src/screens/OnboardingScreen';
import AuthNavigator      from './src/screens/AuthNavigator';
import HomeNavigator      from './src/screens/home/HomeNavigator';

// Garde le splash natif visible tant que les polices chargent
ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'onboarding' | 'auth' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Poppins_300Light,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await ExpoSplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />

      {screen === 'splash' && (
        <SplashScreen onFinish={() => setScreen('onboarding')} />
      )}
      {screen === 'onboarding' && (
        <OnboardingScreen onFinish={() => setScreen('auth')} />
      )}
      {screen === 'auth' && (
        <AuthNavigator onComplete={() => setScreen('home')} />
      )}
      {screen === 'home' && (
        <HomeNavigator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
