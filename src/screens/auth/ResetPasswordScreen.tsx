import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import { colors, fonts, spacing, TOP_INSET } from '../../theme';
import * as authService from '../../services/auth';
import { getErrorMessage } from '../../utils/errorUtils';

interface Props {
  onDone: () => void;
}

const IconLock = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.accent} />
    <Path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke={colors.accent} />
    <Path d="M12 16a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill={colors.accent} stroke="none" />
  </Svg>
);

const IconLockInput = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.muted} />
    <Path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke={colors.muted} />
  </Svg>
);

export default function ResetPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleSubmit = async () => {
    if (!password) { setErreur('Entre ton nouveau mot de passe.'); return; }
    if (password.length < 6) { setErreur('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (password !== confirm) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    setErreur(null);
    setLoading(true);
    try {
      await authService.updatePassword(password);
      setSuccess(true);
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
        <View style={{ height: 24 }} />

        <View style={styles.bigIco}>
          <IconLock />
        </View>

        <Text style={styles.h1}>Nouveau{'\n'}mot de passe</Text>
        <Text style={styles.sub}>
          {success
            ? 'Ton mot de passe a été mis à jour. Tu peux maintenant te connecter.'
            : 'Choisis un nouveau mot de passe sécurisé pour ton compte LASSI.'}
        </Text>
        <View style={{ height: 28 }} />

        {!success && (
          <>
            <InputField
              label="Nouveau mot de passe"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              leftIcon={<IconLockInput />}
              secureTextEntry
              textContentType="newPassword"
              scrollRef={scrollRef}
              returnKeyType="next"
            />
            <InputField
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              leftIcon={<IconLockInput />}
              secureTextEntry
              textContentType="newPassword"
              scrollRef={scrollRef}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        {!success ? (
          <AuthButton label="Enregistrer le mot de passe" onPress={handleSubmit} loading={loading} />
        ) : (
          <AuthButton label="Se connecter" onPress={onDone} />
        )}

        <TouchableOpacity style={styles.skipRow} onPress={onDone} activeOpacity={0.7}>
          <Text style={styles.skipTxt}>Annuler</Text>
        </TouchableOpacity>

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
  skipRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  skipTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
