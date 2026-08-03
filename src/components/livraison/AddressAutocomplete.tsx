import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

const IcoGPS = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <SvgCircle cx={12} cy={12} r={9} stroke="#FDCF34" strokeWidth={1.5} fill="none"/>
    <SvgCircle cx={12} cy={12} r={4} fill="#FDCF34"/>
    <Path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="#FDCF34" strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

const IcoMapPin = () => (
  <Svg width={13} height={14} viewBox="0 0 13 16">
    <Path d="M6.5 0C3.46 0 1 2.46 1 5.5c0 4.12 5.5 9.5 5.5 9.5S12 9.62 12 5.5C12 2.46 9.54 0 6.5 0z" fill="#FDCF3440" stroke="#FDCF34" strokeWidth={1.2}/>
    <SvgCircle cx={6.5} cy={5.5} r={2} fill="#FDCF34"/>
  </Svg>
);
import { colors, fonts, radius } from '../../theme';
import { DakarAddress, searchAddresses, parseGpsCoords } from '../../data/dakarAddresses';
import { reverseGeocode } from '../../services/location';

interface Props {
  label?: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  onSelect: (addr: DakarAddress) => void;
}

// Entrée synthétique représentant une position GPS détectée
const GPS_ID = '__gps__';

export default function AddressAutocomplete({
  label,
  value,
  placeholder = 'Quartier, rue, lieu…',
  onChangeText,
  onSelect,
}: Props) {
  const [suggestions, setSuggestions] = useState<DakarAddress[]>([]);
  const [open, setOpen] = useState(false);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (text: string) => {
      onChangeText(text);

      // ── Détection coordonnées GPS collées ──────────────────────────────
      const gps = parseGpsCoords(text);
      if (gps) {
        // Suggestion immédiate pendant le géocodage
        const placeholder: DakarAddress = {
          id: GPS_ID,
          label: 'Localisation en cours…',
          keywords: [],
          zone: `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`,
          lat: gps.lat,
          lng: gps.lng,
        };
        setSuggestions([placeholder]);
        setOpen(true);

        // Géocodage inverse pour avoir le vrai nom du quartier
        if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
        geocodeTimerRef.current = setTimeout(async () => {
          const addrLabel = await reverseGeocode(gps.lat, gps.lng);
          setSuggestions([{
            id: GPS_ID,
            label: addrLabel,
            keywords: [],
            zone: 'Position GPS détectée',
            lat: gps.lat,
            lng: gps.lng,
          }]);
          setOpen(true);
        }, 400);
        return;
      }

      // ── Recherche normale dans la base d'adresses ─────────────────────
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
                {addr.id === GPS_ID ? <IcoGPS /> : <IcoMapPin />}
                <View style={s.itemText}>
                  <Text style={s.itemLabel} numberOfLines={1}>
                    {addr.label}
                  </Text>
                  <Text style={[s.itemZone, addr.id === GPS_ID && s.itemZoneGps]}>
                    {addr.zone}
                  </Text>
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
  itemZoneGps: {
    color: colors.accent,
  },
});
