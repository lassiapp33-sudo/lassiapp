import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import BackButton from '../../components/auth/BackButton';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import NoteBox    from '../../components/auth/NoteBox';
import { colors, fonts, spacing, TOP_INSET } from '../../theme';

interface Props {
  onBack:  () => void;
  onLogin: () => void;
}

const IconMail = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.accent} />
    <Path d="m22 7-10 5L2 7" stroke={colors.accent} />
  </Svg>
);

const IconMailInput = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}>
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.muted} />
    <Path d="m22 7-10 5L2 7" stroke={colors.muted} />
  </Svg>
);

export default function ForgotPasswordScreen({ onBack, onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);

  const handleSend = () => {
    if (!email.trim()) return;
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={onBack} />
        <View style={{ height: 24 }} />

        {/* Icône email */}
        <View style={styles.bigIco}>
          <IconMail />
        </View>

        <Text style={styles.h1}>{'Mot de passe\noublié ?'}</Text>
        <Text style={styles.sub}>
          Entre ton email, on t'envoie un lien gratuit pour réinitialiser ton mot de passe.
        </Text>
        <View style={{ height: 28 }} />

        <InputField
          label="Email du compte"
          placeholder="ton@email.com"
          value={email}
          onChangeText={setEmail}
          leftIcon={<IconMailInput />}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <AuthButton
          label={sent ? 'Lien envoyé ✓' : 'Envoyer le lien'}
          onPress={handleSend}
        />

        <NoteBox
          text="Pas d'email enregistré ? Contacte le support LASSİ pour récupérer ton compte."
          style={{ marginTop: 18 }}
        />

        {/* Retour connexion */}
        <View style={styles.swapRow}>
          <Text style={styles.swapTxt}>Je m'en souviens — </Text>
          <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
            <Text style={styles.swapLink}>Connexion</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
    flexGrow: 1,
  },
  bigIco: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  h1: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
    marginTop: 10,
  },
  swapRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  swapTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  swapLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
});
