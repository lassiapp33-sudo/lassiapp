import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import Avatar from '../Avatar';
import { ClassementEntry } from '../../services/classementService';

interface Props {
  entries: ClassementEntry[];
  monId?: string;
  /** 'shop' pour les listes prestataires (logo boutique), 'user' pour les clients. */
  variant?: 'user' | 'shop';
}

export default function ListeClassement({ entries, monId, variant = 'shop' }: Props) {
  return (
    <FlatList
      data={entries}
      keyExtractor={(item, i) => `${item.rang}-${i}`}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      renderItem={({ item }) => {
        const cestMoi = item.prestataire_id === monId || item.client_id === monId;
        return (
          <View style={[styles.row, cestMoi && styles.moi]}>
            <Text style={styles.rang}>{item.rang}</Text>
            <Avatar imageUrl={item.image_url} name={item.nom_affiche} size={40} variant={variant} />
            <Text style={styles.nom} numberOfLines={1}>
              {item.nom_affiche}
            </Text>
            <Text style={styles.pts}>{item.points} pts</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: 8,
    gap: 12,
  },
  moi: { borderWidth: 1.5, borderColor: colors.accent },
  rang: { color: colors.muted, fontFamily: fonts.ui, fontSize: 15, width: 28, textAlign: 'center' },
  nom: { flex: 1, color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  pts: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },
});
