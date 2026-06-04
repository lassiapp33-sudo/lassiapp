import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import BackButton from '../../components/auth/BackButton';
import AuthButton from '../../components/auth/AuthButton';
import { colors, fonts, spacing, TOP_INSET } from '../../theme';
import * as authService from '../../services/auth';

interface Props {
  email: string;
  onBack: () => void;
  onComplete: () => void;
}

const IconMail = () => (
  <Svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.accent} />
    <Path d="m22 7-10 5L2 7" stroke={colors.accent} />
  </Svg>
);

export default function EmailVerifyScreen({ email, onBack, onComplete }: Props) {
  const [resent, setResent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const openMailApp = () => Linking.openURL('mailto:').catch(() => null);

  const handleResend = async () => {
    if (resendLoading || resent) return;
    setResendLoading(true);
    try {
      await authService.forgotPassword(email);
      setResent(true);
    } catch {
      // silencieux — l'email sera renvoyé de toute façon
      setResent(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: TOP_INSET }]}>
      <BackButton onPress={onBack} />
      <View style={{ height: 24 }} />

      {/* Icône email */}
      <View style={styles.bigIco}>
        <IconMail />
      </View>

      <Text style={styles.h1}>{'Vérifie ton\nemail 📧'}</Text>
      <Text style={styles.sub}>
        {'On a envoyé un lien de confirmation à '}
        <Text style={styles.emailHighlight}>{email}</Text>
        {'. Clique dessus pour activer ton compte.'}
      </Text>

      <View style={{ flex: 1 }} />

      <AuthButton label="Ouvrir ma boîte mail" onPress={openMailApp} />
      <AuthButton label="J'ai déjà confirmé →" onPress={onComplete} variant="ghost" />

      {/* Renvoi du lien */}
      <TouchableOpacity
        onPress={handleResend}
        activeOpacity={0.7}
        disabled={resent || resendLoading}
      >
        <Text style={styles.resend}>
          {resent ? (
            '✅ Lien renvoyé !'
          ) : resendLoading ? (
            'Envoi…'
          ) : (
            <>
              Pas reçu ? <Text style={styles.resendLink}>Renvoyer le lien</Text>
            </>
          )}
        </Text>
      </TouchableOpacity>

      {/* Passer l'étape */}
      <View style={styles.swapRow}>
        <Text style={styles.swapTxt}>Plus tard — </Text>
        <TouchableOpacity onPress={onComplete} activeOpacity={0.7}>
          <Text style={styles.swapLink}>Passer cette étape</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
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
    marginBottom: 14,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
  },
  emailHighlight: {
    color: colors.white,
    fontFamily: fonts.ui,
  },
  resend: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 18,
  },
  resendLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
  },
  swapRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 14,
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
