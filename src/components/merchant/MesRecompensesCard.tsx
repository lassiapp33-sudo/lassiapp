import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { getMesRecompenses, RecompenseAttribuee } from '../../services/classementService';

const IcoGift = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M20 12v10H4V12" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 7H2v5h20V7z" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 22V7" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function expireLabel(r: RecompenseAttribuee): string {
  if (!r.valide_jusqu_a) return 'Illimité';
  const diff = Math.ceil(
    (new Date(r.valide_jusqu_a).getTime() - Date.now()) / 86400_000,
  );
  if (diff <= 0) return 'Expiré';
  if (diff === 1) return 'Expire demain';
  if (diff <= 30) return `${diff}j restants`;
  return `${Math.ceil(diff / 30)} mois restants`;
}

function buildChips(r: RecompenseAttribuee): string[] {
  const chips: string[] = [];
  if (r.badge) chips.push(r.badge);
  if (r.certificat) chips.push('🎖️ Certificat officiel');
  if (r.priorite_recherche) chips.push('⚡ Priorité recherche');
  if (r.top_vip) chips.push('🏆 Top VIP');
  if (r.credit_lassi > 0) chips.push(`💰 ${r.credit_lassi.toLocaleString('fr-FR')} F crédit`);
  if (r.carrousel_produits > 0) chips.push(`👑 ${r.carrousel_produits} offre${r.carrousel_produits > 1 ? 's' : ''} quartier`);
  return chips;
}

interface Props {
  userId: string;
}

export default function MesRecompensesCard({ userId }: Props) {
  const [recompenses, setRecompenses] = useState<RecompenseAttribuee[]>([]);

  useEffect(() => {
    getMesRecompenses(userId)
      .then(rows => {
        const now = Date.now();
        setRecompenses(
          rows.filter(r =>
            r.est_actif &&
            (!r.valide_jusqu_a || new Date(r.valide_jusqu_a).getTime() > now),
          ),
        );
      })
      .catch(() => {});
  }, [userId]);

  if (recompenses.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <IcoGift />
        <Text style={styles.title}>Tes récompenses actives</Text>
      </View>

      {recompenses.map(r => {
        const chips = buildChips(r);
        if (chips.length === 0) return null;
        return (
          <View key={r.id} style={styles.row}>
            <View style={styles.chips}>
              {chips.map(c => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipTxt}>{c}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.expire}>{expireLabel(r)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(253,207,52,.06)',
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  row: {
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: `${colors.accent}18`,
    borderWidth: 1,
    borderColor: `${colors.accent}35`,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11.5,
  },
  expire: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginLeft: 2,
  },
});
