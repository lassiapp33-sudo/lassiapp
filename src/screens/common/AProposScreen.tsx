import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Constants from 'expo-constants';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiLogo from '../../components/LassiLogo';
import LassiRoiScintillant from '../../components/LassiRoiScintillant';
import LassiScreen from '../../components/LassiScreen';
import MascoHomeBtn from '../../components/MascoHomeBtn';
import { contacterServiceClient } from '../../config/contact';
import CGUScreen from './CGUScreen';
import ConfidentialiteScreen from './ConfidentialiteScreen';
import { IcoBack } from '../../components/icons';

// ─── Version dynamique depuis app.json ───────────────────────────────────────

const appVersion = Constants.expoConfig?.version ?? '1.0.0';
const buildIos = Constants.expoConfig?.ios?.buildNumber;
const buildAndroid = Constants.expoConfig?.android?.versionCode;
const buildNumber =
  Platform.OS === 'ios' ? buildIos : buildAndroid != null ? String(buildAndroid) : undefined;
const versionLabel = buildNumber
  ? `Version ${appVersion} (build ${buildNumber})`
  : `Version ${appVersion}`;

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoChevron = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M9 18l6-6-6-6" stroke={colors.muted} />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function AProposScreen({ onBack }: Props) {
  const [showCGU, setShowCGU] = useState(false);
  const [showConfidentialite, setShowConfidentialite] = useState(false);

  if (showCGU) return <CGUScreen onBack={() => setShowCGU(false)} />;
  if (showConfidentialite)
    return <ConfidentialiteScreen onBack={() => setShowConfidentialite(false)} />;

  return (
    <LassiScreen
      header={
        <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={s.headerTitle}>À propos</Text>
          <MascoHomeBtn />
        </View>
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo + mascotte ───────────────────────────────────────────── */}
        <View style={s.hero}>
          <LassiRoiScintillant />
          <LassiLogo width={160} style={s.logo} />
          <Text style={s.slogan}>Ton quartier, à portée de main.</Text>
        </View>

        {/* ── Version ───────────────────────────────────────────────────── */}
        <View style={s.versionWrap}>
          <Text style={s.versionTxt}>{versionLabel}</Text>
        </View>

        {/* ── Description ───────────────────────────────────────────────── */}
        <View style={s.descWrap}>
          <Text style={s.descTxt}>
            LASSİ connecte les habitants de Dakar aux commerçants et prestataires de leur quartier :
            restos, tangana, coiffeurs, salles de sport, boutiques et plus encore. Découvre,
            commande et paie facilement, près de chez toi.
          </Text>
        </View>

        {/* ── Liens ─────────────────────────────────────────────────────── */}
        <View style={s.linksWrap}>
          <TouchableOpacity style={s.linkRow} onPress={() => setShowCGU(true)} activeOpacity={0.75}>
            <Text style={s.linkTxt}>Conditions Générales d'Utilisation</Text>
            <IcoChevron />
          </TouchableOpacity>

          <View style={s.sep} />

          <TouchableOpacity
            style={s.linkRow}
            onPress={() => setShowConfidentialite(true)}
            activeOpacity={0.75}
          >
            <Text style={s.linkTxt}>Politique de confidentialité</Text>
            <IcoChevron />
          </TouchableOpacity>

          <View style={s.sep} />

          <TouchableOpacity
            style={s.linkRow}
            onPress={() => contacterServiceClient()}
            activeOpacity={0.75}
          >
            <Text style={s.linkTxt}>Contacter le service client</Text>
            <IcoChevron />
          </TouchableOpacity>
        </View>

        {/* ── Bas de page ───────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerLine}>Fait avec ❤️ au Sénégal 🇸🇳</Text>
          <Text style={s.footerCopy}>© 2026 LASSİ. Tous droits réservés.</Text>
        </View>
      </ScrollView>
    </LassiScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40, flexGrow: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
    gap: 12,
  },
  logo: {
    marginTop: 4,
  },
  slogan: {
    color: '#8a8eb5',
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Version
  versionWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  versionTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  // Description
  descWrap: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  descTxt: {
    color: '#e8e9f5',
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
  },

  // Liens
  linksWrap: {
    marginHorizontal: 18,
    marginBottom: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkTxt: {
    color: '#e8e9f5',
    fontFamily: fonts.body,
    fontSize: 13.5,
    flex: 1,
  },
  sep: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
    gap: 4,
  },
  footerLine: {
    color: '#8a8eb5',
    fontFamily: fonts.body,
    fontSize: 13,
  },
  footerCopy: {
    color: '#4a4c6a',
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
