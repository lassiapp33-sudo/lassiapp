import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { Debtor, DebtStatus } from '../../types/debts';
import Avatar from '../Avatar';

// Couleur officielle WhatsApp — uniquement pour ce bouton
const WA_COLOR = '#25D366';

// Mapping statut → couleurs
const STATUS: Record<DebtStatus, { stripe: string; dot: string; text: string }> = {
  late:  { stripe: colors.danger,  dot: colors.danger,  text: colors.danger  },
  watch: { stripe: colors.orange,  dot: colors.orange,  text: colors.orange  },
  good:  { stripe: colors.success, dot: colors.success, text: colors.success },
};

const IcoWA = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
      stroke={WA_COLOR}
    />
  </Svg>
);

// Génère le message WhatsApp pré-rempli
function buildWaUrl(debtor: Debtor): string {
  const msg =
    `Bonjour ${debtor.name} 👋\n\n` +
    `Tu as une dette de *${debtor.amount.toLocaleString('fr-FR')} FCFA*.\n\n` +
    `Merci de régulariser dès que possible 🙏\n` +
    `— LASSİ`;
  const phone = debtor.phone ?? '';
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
}

interface Props {
  debtor:  Debtor;
  onPress?: () => void;
}

export default function DebtorCard({ debtor, onPress }: Props) {
  const sc = STATUS[debtor.status];

  const handleRelance = () => {
    const url = buildWaUrl(debtor);
    Linking.openURL(url).catch(() => {
      // Fallback SMS si WhatsApp absent
      if (debtor.phone) Linking.openURL(`sms:${debtor.phone}`);
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Barre colorée gauche — repérage visuel instantané */}
      <View style={[styles.stripe, { backgroundColor: sc.stripe }]} />

      {/* Avatar débiteur + pastille statut — wrapper relatif pour positionner le dot */}
      <View style={styles.avatarWrap}>
        <Avatar
          imageUrl={debtor.avatarUrl}
          name={debtor.name}
          size={46}
          variant="user"
        />
        <View style={[styles.pdot, { backgroundColor: sc.dot }]} />
      </View>

      {/* Infos client */}
      <View style={styles.info}>
        <Text style={styles.name}>{debtor.name}</Text>
        <View style={styles.meta}>
          <Text style={[styles.tranche, { color: sc.text }]}>
            ● {debtor.statusLabel}
          </Text>
          <Text style={styles.date}>· depuis {debtor.daysSince}j</Text>
        </View>
      </View>

      {/* Montant + bouton relance */}
      <View style={styles.right}>
        <Text style={styles.due}>{debtor.amount.toLocaleString('fr-FR')} F</Text>
        <TouchableOpacity
          style={styles.waBtn}
          onPress={handleRelance}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <IcoWA />
          <Text style={styles.waTxt}>Relancer</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },

  // Bande colorée absolue — 4px, tout à gauche
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  // Wrapper relatif autour d'Avatar pour positionner la pastille de statut
  avatarWrap: {
    flexShrink:     0,
    position:       'relative',
  },
  pdot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },

  info: { flex: 1, minWidth: 0 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 3,
  },
  tranche: {
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  date: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },

  right: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  due: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Bouton WhatsApp — couleur verte officielle
  waBtn: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: 'rgba(37,211,102,.13)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  waTxt: {
    color: WA_COLOR,
    fontFamily: fonts.title,
    fontSize: 11,
  },
});
