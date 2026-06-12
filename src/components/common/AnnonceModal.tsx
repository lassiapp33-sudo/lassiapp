import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { Annonce } from '../../hooks/useAnnonces';

interface Props {
  annonce: Annonce | null;
  nbRestantes: number;
  onFermer: () => void;
}

// Modale d'annonce système plein écran (style "patch notes" PUBG, adapté à
// la charte LASSI) — affichée au démarrage de l'app pour chaque annonce
// non lue ciblant le compte connecté, une à la fois en file FIFO.
export default function AnnonceModal({ annonce, nbRestantes, onFermer }: Props) {
  if (!annonce) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onFermer}>
      <View style={s.overlay}>
        <View style={s.card}>
          {annonce.tag && (
            <View style={s.tagPill}>
              <Text style={s.tagTxt}>{annonce.tag.toUpperCase()}</Text>
            </View>
          )}

          <Text style={s.emoji}>{annonce.icone}</Text>
          <Text style={s.title}>{annonce.titre}</Text>
          <Text style={s.body}>{annonce.corps}</Text>

          <TouchableOpacity style={s.cta} onPress={onFermer} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>{nbRestantes > 0 ? `Suivant (${nbRestantes})` : "C'est compris !"}</Text>
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
  tagPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(253,207,52,.13)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  tagTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  emoji: { fontSize: 44, marginBottom: 4 },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 16,
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
