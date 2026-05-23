import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BackButton  from '../../components/auth/BackButton';
import InputField  from '../../components/auth/InputField';
import AuthButton  from '../../components/auth/AuthButton';
import NoteBox     from '../../components/auth/NoteBox';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';

type Role = 'client' | 'merchant';

interface UserData {
  name:  string;
  phone: string;
  email: string;
}

interface Props {
  role:     Role;
  onBack:   () => void;
  onSuccess:(userData: UserData) => void;
  onLogin:  () => void;
}

// Icônes inline
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
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={1.7}
    strokeLinecap="round">
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

// Puce de rôle
const RoleChip = ({ role }: { role: Role }) => (
  <View style={styles.chip}>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
      {role === 'client' ? (
        <>
          <Circle cx={9}  cy={21} r={1} stroke={colors.accent} />
          <Circle cx={20} cy={21} r={1} stroke={colors.accent} />
          <Path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"
            stroke={colors.accent} />
        </>
      ) : (
        <>
          <Path d="M3 9l1-5h16l1 5" stroke={colors.accent} />
          <Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={colors.accent} />
          <Path d="M3 9h18" stroke={colors.accent} />
        </>
      )}
    </Svg>
    <Text style={styles.chipTxt}>{role === 'client' ? 'Client' : 'Commerçant'}</Text>
  </View>
);

export default function RegisterScreen({ role, onBack, onSuccess, onLogin }: Props) {
  const [nom,    setNom]    = useState('');
  const [tel,    setTel]    = useState('');
  const [email,  setEmail]  = useState('');
  const [mdp,    setMdp]    = useState('');
  const [showMdp, setShowMdp] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const handleSubmit = () => {
    // Validation minimale — le backend valide côté serveur en Phase 3
    if (!nom.trim() || !tel.trim() || !mdp.trim()) return;
    onSuccess({ name: nom.trim(), phone: tel.trim(), email: email.trim() });
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
        <View style={{ height: 16 }} />

        <RoleChip role={role} />

        <Text style={styles.h1}>Créer ton compte</Text>
        <Text style={styles.sub}>Quelques infos et c'est parti.</Text>

        <View style={{ height: 18 }} />

        <InputField
          label="Nom complet"
          placeholder="Aïssatou Ndiaye"
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
          label="Numéro de téléphone"
          placeholder="77 123 45 67"
          value={tel}
          onChangeText={setTel}
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
          placeholder="ton@email.com"
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
          label="Mot de passe"
          placeholder="Min. 6 caractères"
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
          style={{ marginBottom: 20 }}
        />

        <AuthButton label="Créer mon compte" onPress={handleSubmit} />

        {/* Lien vers connexion */}
        <View style={styles.swapRow}>
          <Text style={styles.swapTxt}>Déjà un compte ? </Text>
          <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
            <Text style={styles.swapLink}>Se connecter</Text>
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
