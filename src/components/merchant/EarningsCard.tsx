import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';

// ─── Icônes (tracé sombre sur fond jaune) ────────────────────────────────────

const DARK = 'rgba(20,21,42,.65)';

const IcoCoin = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={DARK} />
  </Svg>
);

const IcoEye = ({ hidden }: { hidden: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    {hidden ? (
      <Path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
        stroke="rgba(20,21,42,.5)"
        strokeLinecap="round"
      />
    ) : (
      <>
        <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="rgba(20,21,42,.5)" />
        <Circle cx={12} cy={12} r={3} stroke="rgba(20,21,42,.5)" />
      </>
    )}
  </Svg>
);

// ─── Sous-composant mini stat ─────────────────────────────────────────────────

const MiniStat = ({ value, label }: { value: string; label: string }) => (
  <View>
    <Text style={styles.miniVal}>{value}</Text>
    <Text style={styles.miniLbl}>{label}</Text>
  </View>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  amount: number;
  changeLabel: string; // ex : "▲ +12% par rapport à hier"
  orders: number;
  viaLassi: number;
  debts: number;
}

export default function EarningsCard({ amount, changeLabel, orders, viaLassi, debts }: Props) {
  const [visible, setVisible] = useState(true);

  return (
    <View style={styles.card}>
      {/* Bouton œil — masquer / afficher le montant */}
      <TouchableOpacity
        style={styles.eyeBtn}
        onPress={() => setVisible(v => !v)}
        activeOpacity={0.7}
      >
        <IcoEye hidden={!visible} />
      </TouchableOpacity>

      {/* Label */}
      <View style={styles.label}>
        <IcoCoin />
        <Text style={styles.labelTxt}>Recette du jour</Text>
      </View>

      {/* Montant principal — gros chiffre lisible en plein soleil */}
      <Text style={styles.amount}>{visible ? formatPrice(amount) : '••••• F'}</Text>

      {/* Évolution vs hier */}
      <Text style={styles.cmp}>{changeLabel}</Text>

      {/* Mini stats séparées par une bordure */}
      <View style={styles.mini}>
        <MiniStat value={String(orders)} label="Commandes" />
        <MiniStat value={String(viaLassi)} label="Via LASSİ" />
        <MiniStat value={formatPrice(debts)} label="Dettes en cours" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond plein accent — pas de dégradé (lisible, premium, plein soleil)
  card: {
    backgroundColor: colors.accent,
    borderRadius: 22,
    padding: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
  },

  eyeBtn: {
    position: 'absolute',
    top: 18,
    right: 20,
  },

  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelTxt: {
    color: 'rgba(20,21,42,.65)',
    fontFamily: fonts.title,
    fontSize: 12,
  },

  // Gros chiffre — règle de lisibilité terrain
  amount: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 34,
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 2,
  },

  cmp: {
    color: 'rgba(20,21,42,.6)',
    fontFamily: fonts.ui,
    fontSize: 12,
  },

  mini: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,21,42,.12)',
  },
  miniVal: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  miniLbl: {
    color: 'rgba(20,21,42,.6)',
    fontFamily: fonts.ui,
    fontSize: 10,
    marginTop: 1,
  },
});
