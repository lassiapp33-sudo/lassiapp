import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BackButton from '../../components/auth/BackButton';
import InputField from '../../components/auth/InputField';
import AuthButton from '../../components/auth/AuthButton';
import NoteBox from '../../components/auth/NoteBox';
import LassiLogo from '../../components/LassiLogo';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import { formatPhoneSenegal, cleanPhone, isValidPhone, PHONE_ERROR } from '../../utils/phone';
import { useT } from '../../i18n';
import { getErrorMessage } from '../../utils/errorUtils';

type Role = 'client' | 'merchant';

export interface RegisterData {
  name: string;
  phone: string;
  email: string;
  password: string;
}

interface Props {
  role: Role;
  onBack: () => void;
  onSuccess: (data: RegisterData) => Promise<void>;
  onLogin: () => void;
  onCGU: () => void;
  onConfidentialite: () => void;
}

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IconUser = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={colors.muted} />
    <Circle cx={12} cy={7} r={4} stroke={colors.muted} />
  </Svg>
);

const IconMail = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}>
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.muted} />
    <Path d="m22 7-10 5L2 7" stroke={colors.muted} />
  </Svg>
);

const IconLock = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}>
    <Rect x={3} y={11} width={18} height={11} rx={2} stroke={colors.muted} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.muted} />
  </Svg>
);

const IconEye = ({ off }: { off?: boolean }) => (
  <Svg
    width={19}
    height={19}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.7}
    strokeLinecap="round"
  >
    {off ? (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
          stroke={colors.muted}
        />
        <Path
          d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
          stroke={colors.muted}
        />
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

const RoleChip = ({ role }: { role: Role }) => (
  <View style={styles.chip}>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
      {role === 'client' ? (
        <>
          <Circle cx={9} cy={21} r={1} stroke={colors.accent} />
          <Circle cx={20} cy={21} r={1} stroke={colors.accent} />
          <Path
            d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"
            stroke={colors.accent}
          />
        </>
      ) : (
        <>
          <Path d="M3 9l1-5h16l1 5" stroke={colors.accent} />
          <Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={colors.accent} />
          <Path d="M3 9h18" stroke={colors.accent} />
        </>
      )}
    </Svg>
    <Text style={styles.chipTxt}>{role === 'client' ? 'Client' : 'Prestataire'}</Text>
  </View>
);

// ─── Écran ───────────────────────────────────────────────────────────────────

export default function RegisterScreen({
  role,
  onBack,
  onSuccess,
  onLogin,
  onCGU,
  onConfidentialite,
}: Props) {
  const t = useT();

  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [showMdp, setShowMdp] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const handleSubmit = async () => {
    if (!nom.trim() || !tel.trim() || !mdp.trim()) {
      setErreur('Nom, numéro et mot de passe sont obligatoires.');
      return;
    }
    if (!isValidPhone(tel)) {
      setErreur(PHONE_ERROR);
      return;
    }
    if (mdp.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!cguAccepted) {
      setErreur('Tu dois accepter les CGU et la Politique de confidentialité pour continuer.');
      return;
    }
    setErreur(null);
    setLoading(true);
    try {
      await onSuccess({
        name: nom.trim(),
        phone: cleanPhone(tel), // stocké sans espaces : "781376161"
        email: email.trim(),
        password: mdp,
      });
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
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <LassiLogo width={72} />
        </View>
        <View style={{ height: 16 }} />

        <RoleChip role={role} />

        <Text style={styles.h1}>{t.auth.registerTitle}</Text>
        <Text style={styles.sub}>{t.auth.registerSub}</Text>

        <View style={{ height: 18 }} />

        <InputField
          label={t.auth.nameLabel}
          placeholder={t.auth.namePlaceholder}
          value={nom}
          onChangeText={setNom}
          leftIcon={<IconUser />}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          scrollRef={scrollRef}
          returnKeyType="next"
        />
        <InputField
          label={t.auth.phoneLabel}
          placeholder={t.auth.phonePlaceholder}
          value={tel}
          onChangeText={v => setTel(formatPhoneSenegal(v))}
          phonePrefix
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          scrollRef={scrollRef}
          returnKeyType="next"
        />
        <InputField
          label="Email"
          optional
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          leftIcon={<IconMail />}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          scrollRef={scrollRef}
          returnKeyType="next"
        />
        <InputField
          label={t.auth.passwordLabel}
          placeholder="Min. 8 caractères"
          value={mdp}
          onChangeText={setMdp}
          leftIcon={<IconLock />}
          rightIcon={<IconEye off={showMdp} />}
          onRightPress={() => setShowMdp(v => !v)}
          secureTextEntry={!showMdp}
          autoComplete="new-password"
          textContentType="newPassword"
          scrollRef={scrollRef}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <NoteBox
          text="Ton email sert uniquement à récupérer ton compte si tu oublies ton mot de passe. Pas de spam, promis."
          style={{ marginBottom: 16 }}
        />

        {/* Acceptation CGU */}
        <View style={styles.cguRow}>
          <TouchableOpacity onPress={() => setCguAccepted(v => !v)} activeOpacity={0.8} hitSlop={8}>
            <View style={[styles.cguCheckbox, cguAccepted && styles.cguCheckboxOn]}>
              {cguAccepted && <Text style={styles.cguCheckmark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <Text style={styles.cguText}>
            {"J'ai lu et j'accepte les "}
            <Text style={styles.cguLink} onPress={onCGU}>
              Conditions Générales d'Utilisation
            </Text>
            {' et la '}
            <Text style={styles.cguLink} onPress={onConfidentialite}>
              Politique de confidentialité
            </Text>
            {'.'}
          </Text>
        </View>

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <AuthButton
          label={t.auth.registerBtn}
          onPress={handleSubmit}
          loading={loading}
          style={!cguAccepted ? { opacity: 0.45 } : undefined}
        />

        <View style={styles.swapRow}>
          <Text style={styles.swapTxt}>{t.auth.hasAccount}</Text>
          <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
            <Text style={styles.swapLink}>{t.auth.signIn}</Text>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 13,
    marginBottom: 16,
  },
  chipTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  h1: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
    marginTop: 10,
  },
  cguRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cguCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  cguCheckboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cguCheckmark: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 13,
    lineHeight: 17,
  },
  cguText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  cguLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    textDecorationLine: 'underline',
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
    marginTop: 20,
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
