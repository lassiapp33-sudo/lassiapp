import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import BackButton from '../../components/auth/BackButton';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import NoteBox    from '../../components/auth/NoteBox';
import { colors, fonts, spacing, TOP_INSET } from '../../theme';
import * as authService from '../../services/auth';
import { getErrorMessage } from '../../utils/errorUtils';

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
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [erreur,  setErreur]  = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!email.trim()) {
      setErreur('Entre ton adresse email.');
      return;
    }
    setErreur(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (e: unknown) {
      setErreur(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: TOP_INSET }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={onBack} />
        <View style={{ height: 24 }} />

        <View style={styles.bigIco}>
          <IconMail />
        </View>

        <Text style={styles.h1}>{'Mot de passe\noublié ?'}</Text>
        <Text style={styles.sub}>
          {sent
            ? `Un lien de réinitialisation a été envoyé à ${email}. Vérifie tes mails.`
            : "Entre ton email, on t'envoie un lien gratuit pour réinitialiser ton mot de passe."}
        </Text>
        <View style={{ height: 28 }} />

        {!sent && (
          <InputField
            label="Email du compte"
            placeholder="ton@email.com"
            value={email}
            onChangeText={setEmail}
            leftIcon={<IconMailInput />}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            scrollRef={scrollRef}
            returnKeyType="done"
            onSubmitEditing={handleSend}
          />
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        {!sent ? (
          <AuthButton
            label="Envoyer le lien"
            onPress={handleSend}
            loading={loading}
          />
        ) : (
          <AuthButton
            label="Retour à la connexion"
            onPress={onLogin}
          />
        )}

        <NoteBox
          text="Pas d'email enregistré ? Contacte le support LASSİ pour récupérer ton compte."
          style={{ marginTop: 18 }}
        />

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
  erreur: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
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
