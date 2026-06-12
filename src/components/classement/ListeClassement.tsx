import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import Avatar from '../Avatar';
import { ClassementEntry } from '../../services/classementService';

interface Props {
  entries: ClassementEntry[];
  monId?: string;
  /** 'shop' pour les listes prestataires (logo boutique), 'user' pour les clients. */
  variant?: 'user' | 'shop';
  /** Contenu défilant placé avant la liste (titre, podium, onglets…). */
  ListHeaderComponent?: React.ReactElement | null;
  /** Contenu défilant placé après la liste. */
  ListFooterComponent?: React.ReactElement | null;
}

export default function ListeClassement({
  entries,
  monId,
  variant = 'shop',
  ListHeaderComponent,
  ListFooterComponent,
}: Props) {
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.contentContainer}
      data={entries}
      keyExtractor={(item, i) => `${item.rang}-${i}`}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
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
  list: { flex: 1 },
  contentContainer: { paddingHorizontal: spacing.screen, paddingBottom: 32 },
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
