import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  getCreneauxPrisBeaute,
  genererCreneauxBeaute,
  isCreneauBeauteDisponible,
} from '../../services/beauty';
import { CreneauBeauty } from '../../types/beauty';
import { colors, fonts, radius } from '../../theme';
import logger from '../../utils/logger';

interface Props {
  prestataireId: string;
  heureOuverture: string;
  heureFermeture: string;
  dureeMinutes: number;
  date: string;
  onSelect: (debut: string, fin: string) => void;
}

export default function BeautyCreneaux({
  prestataireId, heureOuverture, heureFermeture, dureeMinutes, date, onSelect,
}: Props) {
  const [creneauxPris, setCreneauxPris] = useState<CreneauBeauty[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const tous = genererCreneauxBeaute(heureOuverture, heureFermeture, dureeMinutes, date);

  const load = useCallback(async () => {
    try {
      const pris = await getCreneauxPrisBeaute(prestataireId, date);
      setCreneauxPris(pris);
    } catch (e) {
      logger.error('[BeautyCreneaux] load:', e);
    } finally {
      setLoading(false);
    }
  }, [prestataireId, date]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    load();

    const channel = supabase
      .channel(`beauty-${prestataireId}-${date}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'beauty_reservations',
        filter: `prestataire_id=eq.${prestataireId}`,
      }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleSelect = (debut: string, fin: string) => {
    if (!isCreneauBeauteDisponible(debut, fin, creneauxPris)) return;
    setSelected(debut);
    onSelect(debut, fin);
  };

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;

  if (tous.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTxt}>Aucun créneau ce jour</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choisir un créneau</Text>
      <FlatList
        data={tous}
        numColumns={3}
        keyExtractor={item => item.debut}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const pris       = !isCreneauBeauteDisponible(item.debut, item.fin, creneauxPris);
          const isSelected = selected === item.debut;
          return (
            <TouchableOpacity
              style={[styles.creneau, pris && styles.pris, isSelected && styles.selectionne]}
              onPress={() => !pris && handleSelect(item.debut, item.fin)}
              disabled={pris}
              activeOpacity={0.8}
            >
              <Text style={[styles.creneauText, pris && styles.prisText, isSelected && styles.selectedText]}>
                {item.debut}
              </Text>
              {pris && <Text style={styles.prisLabel}>Pris</Text>}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { marginTop: 16 },
  label:       { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginBottom: 12, marginHorizontal: 2 },
  grid:        { gap: 10, paddingBottom: 20 },
  creneau:     {
    flex: 1, margin: 4, paddingVertical: 14, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.success, alignItems: 'center',
  },
  pris:        { backgroundColor: `${colors.danger}18`, borderColor: `${colors.danger}60` },
  selectionne: { backgroundColor: `${colors.accent}18`, borderColor: colors.accent },
  creneauText: { color: colors.success, fontFamily: fonts.title, fontSize: 13 },
  prisText:    { color: colors.danger },
  selectedText:{ color: colors.accent },
  prisLabel:   { color: colors.danger, fontSize: 10, marginTop: 2, fontFamily: fonts.body },
  empty:       { paddingVertical: 24, alignItems: 'center' },
  emptyTxt:    { color: colors.danger, fontFamily: fonts.title, fontSize: 13 },
});
