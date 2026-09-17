import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { CatId, CATEGORIES } from '../../config/categories';

// Overrides d'affichage spécifiques à cette grille (label raccourci, multiligne)
const DISPLAY: Partial<Record<CatId, { label?: string }>> = {
  stores: { label: 'Commerçants' },
  hair: { label: 'Beauté &\nSoins' },
  sport: { label: 'Sport' },
  bakery: { label: 'Boulangerie\nPâtisserie' },
  tangana: { label: 'Tangana\n& Ndéki' },
};

const S = colors.accent;

// Glyphe SVG fixe : le conteneur d'icône (aspectRatio 1) le contient sur tout écran.
const GLYPH = 22;

interface Props {
  onSelect?: (id: string, label: string) => void;
}

export default function CategoryGrid({ onSelect }: Props) {
  return (
    <View style={styles.list}>
      {CATEGORIES.map(cat => {
        const d = DISPLAY[cat.id] ?? {};
        const label = d.label ?? cat.label;
        return (
          <TouchableOpacity
            key={cat.id}
            style={styles.item}
            onPress={() => onSelect?.(cat.id, label)}
            activeOpacity={0.75}
          >
            <View style={styles.ico}>{cat.renderIcon(S, GLYPH)}</View>
            <Text
              style={styles.label}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex:1 par item → les 6 catégories se partagent la ligne à parts égales,
  // toujours visibles, sans dépendre de Dimensions (aucun clip du 6ᵉ).
  list: {
    flexDirection: 'row',
    columnGap: 8,
    paddingBottom: 4,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  ico: {
    width: '100%',
    maxWidth: 56,
    aspectRatio: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.white,
    fontFamily: fonts.ui,
    // Police réduite (9) sur les deux plateformes pour que "Commerçants" tienne
    // sur une ligne et "Boulangerie / Pâtisserie" sur deux lignes propres.
    // iOS était en 10 → cassait "Commerça/nts" et "Boulangeri/es".
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 11,
  },
});
