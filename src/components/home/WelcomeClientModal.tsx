import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../../theme';

interface Feature {
  icon: string;
  text: string;
}

const FEATURES: Feature[] = [
  { icon: '🏘️', text: 'Découvre les commerces et prestataires de ton quartier' },
  { icon: '🛒', text: 'Commande en quelques clics et suis ta commande en direct' },
  { icon: '💬', text: 'Discute directement avec les commerçants' },
  { icon: '⭐', text: 'Cumule des points et grimpe dans le classement "Top clients"' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Modal de bienvenue affiché une seule fois au premier accueil d'un nouveau
// compte client — explique l'essentiel de LASSI (voir notification de
// bienvenue insérée par trg_recompense_bienvenue,
// 20260612170000_recompense_bienvenue_client.sql).
export default function WelcomeClientModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.emoji}>👋</Text>
          <Text style={s.title}>Bienvenue sur LASSI !</Text>
          <Text style={s.subtitle}>
            Ton app pour commander dans les commerces de ton quartier, à Dakar.
          </Text>

          <View style={s.list}>
            {FEATURES.map(f => (
              <View key={f.text} style={s.row}>
                <Text style={s.rowIcon}>{f.icon}</Text>
                <Text style={s.rowTxt}>{f.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.cta} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>C'est parti !</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  emoji: { fontSize: 40, marginBottom: 2 },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  list: { width: '100%', gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowTxt: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  cta: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
});
