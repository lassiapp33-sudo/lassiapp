import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { DakarAddress, searchAddresses } from '../../data/dakarAddresses';

interface Props {
  label?: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  onSelect: (addr: DakarAddress) => void;
}

export default function AddressAutocomplete({
  label,
  value,
  placeholder = 'Quartier, rue, lieu…',
  onChangeText,
  onSelect,
}: Props) {
  const [suggestions, setSuggestions] = useState<DakarAddress[]>([]);
  const [open, setOpen] = useState(false);

  const handleChange = useCallback(
    (text: string) => {
      onChangeText(text);
      const results = searchAddresses(text);
      setSuggestions(results);
      setOpen(results.length > 0);
    },
    [onChangeText],
  );

  const handleSelect = useCallback(
    (addr: DakarAddress) => {
      onChangeText(addr.label);
      onSelect(addr);
      setSuggestions([]);
      setOpen(false);
    },
    [onChangeText, onSelect],
  );

  const handleBlur = useCallback(() => {
    // Petit délai pour laisser le tap sur suggestion se déclencher avant de fermer
    setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <View style={s.wrap}>
      {!!label && <Text style={s.label}>{label}</Text>}

      <TextInput
        style={s.input}
        value={value}
        onChangeText={handleChange}
        onBlur={handleBlur}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {open && suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((addr, idx) => (
            <TouchableOpacity
              key={addr.id}
              style={[s.item, idx < suggestions.length - 1 && s.itemBorder]}
              onPress={() => handleSelect(addr)}
              activeOpacity={0.75}
            >
              <View style={s.itemLeft}>
                <Text style={s.itemPin}>📍</Text>
                <View style={s.itemText}>
                  <Text style={s.itemLabel} numberOfLines={1}>
                    {addr.label}
                  </Text>
                  <Text style={s.itemZone}>{addr.zone}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 10 },

  label: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  dropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
    // Élévation pour passer au-dessus des autres éléments
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  item: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemPin: { fontSize: 13 },
  itemText: { flex: 1 },
  itemLabel: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  itemZone: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 10,
    marginTop: 1,
  },
});
