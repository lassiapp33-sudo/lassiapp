import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

interface Props {
  label: string;
  suggestions: { id: string; valeur: string }[];
  valeurSelectionnee: string;
  onSelectionner: (valeur: string) => void;
  placeholderLibre?: string;
}

export default function SelecteurPuces({
  label, suggestions, valeurSelectionnee, onSelectionner, placeholderLibre,
}: Props) {
  const [modeLibre, setModeLibre] = useState(false);
  const [texteLibre, setTexteLibre] = useState('');

  const estSuggestionActive = (valeur: string) =>
    !modeLibre && valeurSelectionnee === valeur;

  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>

      <View style={s.puces}>
        {suggestions.map((sug) => (
          <TouchableOpacity
            key={sug.id}
            style={[s.puce, estSuggestionActive(sug.valeur) && s.puceActive]}
            onPress={() => {
              setModeLibre(false);
              onSelectionner(sug.valeur);
            }}
          >
            <Text style={[s.puceText, estSuggestionActive(sug.valeur) && s.puceTextActive]}>
              {sug.valeur}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[s.puce, modeLibre && s.puceActive]}
          onPress={() => setModeLibre(true)}
        >
          <Text style={[s.puceText, modeLibre && s.puceTextActive]}>✏️ Autre</Text>
        </TouchableOpacity>
      </View>

      {modeLibre && (
        <TextInput
          style={s.inputLibre}
          value={texteLibre}
          onChangeText={(v) => { setTexteLibre(v); onSelectionner(v); }}
          placeholder={placeholderLibre ?? 'Précisez…'}
          placeholderTextColor="#6B6F9E"
          autoFocus
          returnKeyType="done"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20 },
  label: {
    color: '#EDEEF7',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 14,
    marginBottom: 10,
  },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: {
    backgroundColor: '#1E2040',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
  puceActive: { backgroundColor: '#FDCF34', borderColor: '#FDCF34' },
  puceText: { color: '#9A9EC4', fontSize: 13 },
  puceTextActive: { color: '#14152A', fontFamily: 'PoppinsSemiBold' },
  inputLibre: {
    marginTop: 10,
    backgroundColor: '#1E2040',
    borderRadius: 12,
    padding: 12,
    color: '#EDEEF7',
    borderWidth: 1,
    borderColor: '#2A2C52',
  },
});
