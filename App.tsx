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

import { colors }        from './src/theme';
import SplashScreen      from './src/screens/SplashScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import AuthNavigator     from './src/screens/AuthNavigator';
import HomeNavigator     from './src/screens/home/HomeNavigator';
import MerchantNavigator from './src/screens/merchant/MerchantNavigator';
import useAuthStore      from './src/store/authStore';

ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'onboarding' | 'auth' | 'client' | 'merchant';

function getInitialScreen(): Screen {
  // Zustand persist hydrate AsyncStorage de manière synchrone au premier accès
  // Le splash (2.6s) laisse le temps à l'hydratation de se terminer
  return 'splash';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(getInitialScreen);

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

  // Déconnexion : vider authStore + retourner à l'auth
  const handleLogout = () => {
    useAuthStore.getState().logout();
    setScreen('auth');
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />

      {screen === 'splash' && (
        <SplashScreen onFinish={() => {
          // Après le splash, vérifier si l'utilisateur est déjà connecté
          const { isAuthenticated, hasSeenOnboarding, user } = useAuthStore.getState();
          if (isAuthenticated && user) {
            setScreen(user.role === 'merchant' ? 'merchant' : 'client');
          } else if (hasSeenOnboarding) {
            setScreen('auth');
          } else {
            setScreen('onboarding');
          }
        }} />
      )}

      {screen === 'onboarding' && (
        <OnboardingScreen onFinish={() => {
          useAuthStore.getState().setOnboardingSeen();
          setScreen('auth');
        }} />
      )}

      {screen === 'auth' && (
        <AuthNavigator onComplete={(role) =>
          setScreen(role === 'merchant' ? 'merchant' : 'client')
        } />
      )}

      {/* Parcours client */}
      {screen === 'client' && <HomeNavigator onLogout={handleLogout} />}

      {/* Cockpit commerçant */}
      {screen === 'merchant' && <MerchantNavigator onLogout={handleLogout} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
