import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import {
  AdPack,
  AD_PACKS,
  BUDGET_STEPS,
  DURATION_OPTIONS,
  estimateViews,
  formatDuration,
} from '../../services/sponsoredAds';

// ─── Formatage nombre de vues ─────────────────────────────────────────────────

function fmtViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

// ─── Carte de pack ────────────────────────────────────────────────────────────

function PackCard({
  pack,
  selected,
  onSelect,
}: {
  pack: AdPack;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.packCard, selected && s.packCardActive]}
      onPress={onSelect}
      activeOpacity={0.82}
    >
      {pack.popular && (
        <View style={s.badgeWrap}>
          <Text style={s.badgeTxt}>RECOMMANDÉ</Text>
        </View>
      )}
      <Text style={[s.packLabel, selected && s.packLabelActive]}>{pack.label}</Text>
      <Text style={s.packTagline}>{pack.tagline}</Text>

      <View style={s.packRow}>
        <Text style={[s.packCredits, selected && s.packCreditsActive]}>
          {pack.budgetCredits} crédits
        </Text>
        <Text style={s.packDot}>·</Text>
        <Text style={s.packDuration}>{formatDuration(pack.durationHours)}</Text>
      </View>

      <View style={s.packEstWrap}>
        <Text style={s.packEstLabel}>Portée estimée</Text>
        <Text style={[s.packEst, selected && s.packEstActive]}>
          {fmtViews(pack.estMin)} – {fmtViews(pack.estMax)} vues
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Sélecteur de budget personnalisé ────────────────────────────────────────

function BudgetChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipsRow}
    >
      {BUDGET_STEPS.map(step => (
        <TouchableOpacity
          key={step}
          style={[s.chip, value === step && s.chipActive]}
          onPress={() => onChange(step)}
          activeOpacity={0.8}
        >
          <Text style={[s.chipTxt, value === step && s.chipTxtActive]}>
            {step}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Sélecteur de durée ───────────────────────────────────────────────────────

function DurationChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipsRow}
    >
      {DURATION_OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.hours}
          style={[s.chip, value === opt.hours && s.chipActive]}
          onPress={() => onChange(opt.hours)}
          activeOpacity={0.8}
        >
          <Text style={[s.chipTxt, value === opt.hours && s.chipTxtActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export type AdPackSelection =
  | { mode: 'pack'; pack: AdPack }
  | { mode: 'custom'; budgetCredits: number; durationHours: number; estMin: number; estMax: number };

interface Props {
  selection: AdPackSelection;
  onChange: (sel: AdPackSelection) => void;
}

type Tab = 'packs' | 'custom';

export default function AdPackSelector({ selection, onChange }: Props) {
  const [tab, setTab] = useState<Tab>(selection.mode === 'custom' ? 'custom' : 'packs');

  const customBudget =
    selection.mode === 'custom' ? selection.budgetCredits : BUDGET_STEPS[2];
  const customDuration =
    selection.mode === 'custom' ? selection.durationHours : DURATION_OPTIONS[2].hours;

  const handleBudget = (v: number) => {
    const est = estimateViews(v);
    onChange({ mode: 'custom', budgetCredits: v, durationHours: customDuration, estMin: est.min, estMax: est.max });
  };

  const handleDuration = (v: number) => {
    const est = estimateViews(customBudget);
    onChange({ mode: 'custom', budgetCredits: customBudget, durationHours: v, estMin: est.min, estMax: est.max });
  };

  const customEst = estimateViews(customBudget);

  return (
    <View style={s.wrap}>
      {/* Onglets */}
      <View style={s.tabs}>
        {(['packs', 'custom'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => {
              setTab(t);
              if (t === 'packs') {
                const defaultPack = AD_PACKS.find(p => p.popular) ?? AD_PACKS[1];
                onChange({ mode: 'pack', pack: defaultPack });
              } else {
                const est = estimateViews(customBudget);
                onChange({ mode: 'custom', budgetCredits: customBudget, durationHours: customDuration, estMin: est.min, estMax: est.max });
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'packs' ? 'Packs clés en main' : 'Personnalisé'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'packs' ? (
        <View style={s.packsWrap}>
          {AD_PACKS.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              selected={selection.mode === 'pack' && selection.pack.id === pack.id}
              onSelect={() => onChange({ mode: 'pack', pack })}
            />
          ))}
        </View>
      ) : (
        <View style={s.customWrap}>
          {/* Budget */}
          <Text style={s.customLabel}>Budget (en crédits LASSI)</Text>
          <BudgetChips value={customBudget} onChange={handleBudget} />

          {/* Durée */}
          <Text style={[s.customLabel, { marginTop: 16 }]}>Durée de diffusion</Text>
          <DurationChips value={customDuration} onChange={handleDuration} />

          {/* Estimation */}
          <View style={s.estBox}>
            <Text style={s.estLabel}>Portée estimée</Text>
            <Text style={s.estValue}>
              {fmtViews(customEst.min)} – {fmtViews(customEst.max)} vues
            </Text>
            <Text style={s.estHint}>
              Diffusion pendant {formatDuration(customDuration)} · {customBudget} crédits
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginBottom: 22 },

  // Onglets
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  tabTxtActive: {
    color: colors.bg,
  },

  // Packs
  packsWrap: { gap: 10 },
  packCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  packCardActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.05)',
  },
  badgeWrap: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  packLabel: {
    color: colors.muted,
    fontFamily: fonts.titleXL,
    fontSize: 16,
    marginBottom: 2,
  },
  packLabelActive: { color: colors.white },
  packTagline: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 10,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  packCredits: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  packCreditsActive: { color: colors.accent },
  packDot: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  packDuration: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  packEstWrap: {
    backgroundColor: 'rgba(0,0,0,.2)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  packEstLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    marginBottom: 2,
  },
  packEst: {
    color: colors.muted,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  packEstActive: { color: colors.white },

  // Chips (budget + durée)
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.1)',
  },
  chipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  chipTxtActive: { color: colors.accent },

  // Mode personnalisé
  customWrap: { gap: 0 },
  customLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
    marginBottom: 10,
  },

  // Box estimation
  estBox: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  estLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: 4,
  },
  estValue: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    marginBottom: 4,
  },
  estHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
