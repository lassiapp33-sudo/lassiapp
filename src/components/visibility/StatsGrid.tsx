import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';
import { VisibilityStats } from '../../services/visibilityPayment';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoEye = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke={color} />
    <Circle cx={12} cy={12} r={3} stroke={color} />
  </Svg>
);

const IcoClick = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path
      d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      stroke={color}
    />
  </Svg>
);

const IcoChat = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={color} />
  </Svg>
);

const IcoCoin = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={color} />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stats: VisibilityStats | null;
  loading?: boolean;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StatsGrid({ stats, loading = false }: Props) {
  const dash = loading ? null : '—';

  const boxes = [
    {
      Icon: IcoEye,
      color: colors.accent,
      iconBg: 'rgba(253,207,52,.12)',
      label: 'Vues ce mois',
      value: stats != null ? String(stats.viewsThisMonth) : dash,
    },
    {
      Icon: IcoClick,
      color: colors.success,
      iconBg: 'rgba(95,211,138,.12)',
      label: 'Clics vers ta boutique',
      value: stats != null ? String(stats.visitsSinceSub) : dash,
    },
    {
      Icon: IcoChat,
      color: colors.accent,
      iconBg: 'rgba(253,207,52,.12)',
      label: 'Commandes ce mois',
      value: stats != null ? String(stats.ordersThisMonth) : dash,
    },
    {
      Icon: IcoCoin,
      color: colors.success,
      iconBg: 'rgba(95,211,138,.12)',
      label: 'Ventes générées (F)',
      value: stats != null ? formatPrice(stats.revenueThisMonth) : dash,
    },
  ];

  const pairs = [boxes.slice(0, 2), boxes.slice(2, 4)];

  return (
    <View style={styles.wrap}>
      {pairs.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((box, si) => (
            <View key={si} style={styles.box}>
              <View style={[styles.iconBox, { backgroundColor: box.iconBg }]}>
                <box.Icon color={box.color} />
              </View>
              {loading ? (
                <ActivityIndicator size="small" color={colors.muted} style={styles.loader} />
              ) : (
                <Text style={[styles.value, box.value === '—' && styles.valueMuted]}>
                  {box.value}
                </Text>
              )}
              <Text style={styles.label}>{box.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 18,
    gap: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 11,
  },
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  loader: {
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  value: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    marginBottom: 2,
  },
  valueMuted: {
    color: colors.muted,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
