import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import type { ProduitExtrait } from '../../utils/parsingMenu';

interface Props {
  onProduitsExtraits: (produits: ProduitExtrait[]) => void;
}

export default function ScannerMenu(_props: Props) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Scanner mon menu</Text>
      <Text style={s.body}>
        La reconnaissance de texte par photo n'est pas encore disponible sur iPhone.
        Ajoutez vos produits manuellement.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
  },
  title: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
