import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import MascoHomeBtn from '../../components/MascoHomeBtn';
import { CGU_SECTIONS, VERSION, DATE_MAJ } from '../../legal/cgu';
import { IcoBack } from '../../components/icons';

interface Props {
  onBack: () => void;
}

export default function CGUScreen({ onBack }: Props) {
  return (
    <LassiScreen
      header={
        <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            Conditions d'Utilisation
          </Text>
          <MascoHomeBtn />
        </View>
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {CGU_SECTIONS.map((section, i) => (
          <View key={i} style={s.section}>
            <Text style={s.sectionTitle}>{section.titre}</Text>
            <Text style={s.sectionBody}>{section.contenu}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text style={s.footerTxt}>
            Version {VERSION} — Mis à jour le {DATE_MAJ}
          </Text>
        </View>
      </ScrollView>
    </LassiScreen>
  );
}

const s = StyleSheet.create({
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
    fontSize: 17,
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 16 },

  section: {
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  sectionTitle: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13.5,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  sectionBody: {
    color: '#e0e1f0',
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 21,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  footerTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
