import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BackButton from '../../components/auth/BackButton';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import { colors, fonts, spacing, TOP_INSET } from '../../theme';
import { formatPhoneSenegal, cleanPhone, isValidPhone, PHONE_ERROR } from '../../utils/phone';
import { useT } from '../../i18n';

interface Props {
  onBack:           () => void;
  // Async : peut rejeter avec une Error (message d'erreur en français)
  onSuccess:        (phone: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
  onRegister:       () => void;
}

const IconLock = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}>
    <Rect x={3} y={11} width={18} height={11} rx={2} stroke={colors.muted} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.muted} />
  </Svg>
);

const IconEye = ({ off }: { off?: boolean }) => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.7} strokeLinecap="round">
    {off ? (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
          stroke={colors.muted} />
        <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
          stroke={colors.muted} />
        <Path d="M1 1l22 22" stroke={colors.muted} />
      </>
    ) : (
      <>
        <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke={colors.muted} />
        <Circle cx={12} cy={12} r={3} stroke={colors.muted} />
      </>
    )}
  </Svg>
);

export default function LoginScreen({ onBack, onSuccess, onForgotPassword, onRegister }: Props) {
  const t = useT();

  const [tel,     setTel]     = useState('');
  const [mdp,     setMdp]     = useState('');
  const [showMdp, setShowMdp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const handleSubmit = async () => {
    if (!tel.trim() || !mdp.trim()) {
      setErreur('Saisis ton numéro et ton mot de passe.');
      return;
    }
    if (!isValidPhone(tel)) {
      setErreur(PHONE_ERROR);
      return;
    }
    setErreur(null);
    setLoading(true);
    try {
      await onSuccess(cleanPhone(tel), mdp);
    } catch (e: any) {
      setErreur(e.message ?? 'Une erreur est survenue. Réessaie.');
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

        <Text style={styles.h1}>{t.auth.welcomeBack}</Text>
        <Text style={styles.sub}>{t.auth.welcomeBackSub}</Text>
        <View style={{ height: 28 }} />

        <InputField
          label={t.auth.phoneLabel}
          placeholder={t.auth.phonePlaceholder}
          value={tel}
          onChangeText={(v) => setTel(formatPhoneSenegal(v))}
          phonePrefix
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          scrollRef={scrollRef}
          returnKeyType="next"
        />
        <InputField
          label={t.auth.passwordLabel}
          placeholder="········"
          value={mdp}
          onChangeText={setMdp}
          leftIcon={<IconLock />}
          rightIcon={<IconEye off={showMdp} />}
          onRightPress={() => setShowMdp(v => !v)}
          secureTextEntry={!showMdp}
          autoComplete="current-password"
          textContentType="password"
          scrollRef={scrollRef}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity onPress={onForgotPassword} activeOpacity={0.7} style={styles.forgot}>
          <Text style={styles.forgotTxt}>{t.auth.forgotPassword}</Text>
        </TouchableOpacity>

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <AuthButton
          label={t.auth.loginBtn}
          onPress={handleSubmit}
          loading={loading}
        />

        <View style={styles.swapRow}>
          <Text style={styles.swapTxt}>{t.auth.noAccount}</Text>
          <TouchableOpacity onPress={onRegister} activeOpacity={0.7}>
            <Text style={styles.swapLink}>{t.auth.createAccount}</Text>
          </TouchableOpacity>
        </View>
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
  forgot: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12.5,
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
    marginTop: 32,
  },
  swapTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  swapLink: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
});
