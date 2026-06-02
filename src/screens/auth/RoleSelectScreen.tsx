import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import LassiLogo from '../../components/LassiLogo';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import { useT } from '../../i18n';

interface Props {
  onSelectClient:   () => void;
  onSelectMerchant: () => void;
  onLogin:          () => void;
}

// Icône panier (Client)
const IconCart = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={9}  cy={21} r={1} stroke={colors.accent} />
    <Circle cx={20} cy={21} r={1} stroke={colors.accent} />
    <Path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"
      stroke={colors.accent} />
  </Svg>
);

// Icône boutique (Commerçant)
const IconStore = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l1-5h16l1 5"        stroke={colors.white} />
    <Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={colors.white} />
    <Path d="M3 9h18"                stroke={colors.white} />
    <Path d="M9 22V12h6v10"          stroke={colors.white} />
  </Svg>
);

export default function RoleSelectScreen({ onSelectClient, onSelectMerchant, onLogin }: Props) {
  const t = useT();
  return (
    <View style={styles.screen}>
      <View style={{ marginTop: 14 }}>
        <LassiLogo width={100} />
      </View>

      <View style={styles.center}>
        <Text style={styles.h1}>{t.auth.roleTitle}</Text>
        <Text style={styles.sub}>{t.auth.roleSub}</Text>

        <TouchableOpacity style={styles.card} onPress={onSelectClient} activeOpacity={0.75}>
          <View style={[styles.ico, styles.icoAccent]}>
            <IconCart />
          </View>
          <View style={styles.cardTxt}>
            <Text style={styles.cardTitle}>{t.auth.clientRole}</Text>
            <Text style={styles.cardDesc}>{t.auth.clientRoleDesc}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={onSelectMerchant} activeOpacity={0.75}>
          <View style={[styles.ico, styles.icoDark]}>
            <IconStore />
          </View>
          <View style={styles.cardTxt}>
            <Text style={styles.cardTitle}>{t.auth.merchantRole}</Text>
            <Text style={styles.cardDesc}>{t.auth.merchantRoleDesc}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.loginRow}>
        <Text style={styles.loginTxt}>{t.auth.alreadyAccount}</Text>
        <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
          <Text style={styles.loginLink}>{t.auth.signIn}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: TOP_INSET,
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  h1: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
    marginBottom: 26,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  ico: {
    width: 54,
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icoAccent: { backgroundColor: 'rgba(253, 207, 52, 0.12)' },
  icoDark:   { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  cardTxt:   { flex: 1 },
  cardTitle: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 16,
  },
  cardDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  arrow: {
    color: colors.muted,
    fontSize: 22,
    lineHeight: 26,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  loginTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  loginLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13.5,
  },
});
