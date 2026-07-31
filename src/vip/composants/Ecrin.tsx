import { View, Text, StyleSheet } from 'react-native';
import { royal as r } from '../theme';

const coin = (pos: object) => ({
  position: 'absolute' as const, width: 16, height: 16,
  borderColor: r.couleur.or, borderWidth: 1, ...pos,
});

export function Ecrin({ titre, description, prix, prixBarre, surtitre }: {
  titre: string; description?: string; prix: number; prixBarre?: number | null; surtitre: string;
}) {
  return (
    <View style={s.cadre}>
      <View style={coin({ top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0 })} />
      <View style={coin({ top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0 })} />
      <View style={coin({ bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0 })} />
      <View style={coin({ bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0 })} />
      <Text style={r.caps}>{surtitre}</Text>
      <Text style={s.titre}>{titre}</Text>
      {!!description && <Text style={s.desc}>{description}</Text>}
      <Text style={s.prix}>
        {fcfa(prix)}
        {!!prixBarre && <Text style={s.barre}>{'  '}{fcfa(prixBarre)}</Text>}
      </Text>
    </View>
  );
}

export const fcfa = (n: number) =>
  `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;

const s = StyleSheet.create({
  cadre: {
    marginHorizontal: 20,
    marginTop: 26,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: r.couleur.filet,
  },
  titre: {
    fontFamily: r.police.titre,
    fontSize: 24,
    color: r.couleur.ivoire,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontFamily: r.police.corpsIt,
    fontSize: 15,
    color: r.couleur.gris,
    lineHeight: 24,
    textAlign: 'center',
  },
  prix: {
    fontFamily: r.police.titre,
    fontSize: 20,
    color: r.couleur.orClair,
    letterSpacing: 1.6,
    marginTop: 16,
  },
  barre: {
    fontFamily: r.police.util,
    fontSize: 12,
    color: r.couleur.gris,
    textDecorationLine: 'line-through',
    letterSpacing: 0,
  },
});
