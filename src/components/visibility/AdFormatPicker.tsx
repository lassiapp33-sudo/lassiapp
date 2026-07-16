import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { AdFormat } from '../../services/sponsoredAds';

// ─── Icônes format ────────────────────────────────────────────────────────────

const IcoClassique = ({ active }: { active: boolean }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Rect x={2} y={3} width={20} height={14} rx={2} stroke={active ? colors.bg : colors.muted} />
    <Path d="M4 6h10M4 9h12M4 12h8" stroke={active ? colors.bg : colors.muted} strokeLinecap="round" />
    <Rect x={14} y={6} width={5} height={7} rx={1} stroke={active ? colors.bg : colors.muted} />
    <Path d="M7 20h10" stroke={active ? colors.bg : colors.muted} strokeLinecap="round" />
  </Svg>
);

const IcoAffiche = ({ active }: { active: boolean }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Rect x={4} y={2} width={16} height={20} rx={2} stroke={active ? colors.bg : colors.muted} />
    <Path d="M4 8h16" stroke={active ? colors.bg : colors.muted} />
    <Path d="M7 5h2M11 5h2" stroke={active ? colors.bg : colors.muted} strokeLinecap="round" />
    <Path d="M7 12h10M7 15h6" stroke={active ? colors.bg : colors.muted} strokeLinecap="round" />
  </Svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  selected: AdFormat;
  onSelect: (format: AdFormat) => void;
}

const OPTIONS: { format: AdFormat; label: string; desc: string }[] = [
  {
    format: 'classique',
    label: 'Annonce Classique',
    desc: 'Texte descriptif + image optionnelle',
  },
  {
    format: 'affiche',
    label: 'Affiche',
    desc: 'Image plein écran (flyer publicitaire)',
  },
];

export default function AdFormatPicker({ selected, onSelect }: Props) {
  return (
    <View style={s.wrap}>
      {OPTIONS.map(opt => {
        const active = selected === opt.format;
        return (
          <TouchableOpacity
            key={opt.format}
            style={[s.card, active && s.cardActive]}
            onPress={() => onSelect(opt.format)}
            activeOpacity={0.82}
          >
            <View style={[s.iconBox, active && s.iconBoxActive]}>
              {opt.format === 'classique' ? (
                <IcoClassique active={active} />
              ) : (
                <IcoAffiche active={active} />
              )}
            </View>
            <View style={s.text}>
              <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
              <Text style={s.desc}>{opt.desc}</Text>
            </View>
            {active && (
              <View style={s.check}>
                <Text style={s.checkTxt}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 22,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  cardActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.06)',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxActive: {
    backgroundColor: colors.accent,
  },
  text: { flex: 1 },
  label: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  labelActive: {
    color: colors.white,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
