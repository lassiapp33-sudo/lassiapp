import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme';

// Pré-calculé hors composant pour éviter de recréer les nœuds à chaque rendu
const TOP_FADE_ROWS = Array.from({ length: 8 }, (_, i) => (
  <View
    key={i}
    style={{ flex: 1, backgroundColor: `rgba(20,21,42,${((7 - i) / 7) * 0.88})` }}
  />
));

interface Props {
  /** Zone haute fixe : titre, header, mascotte, chips… */
  header: React.ReactNode;
  /** Zone basse fixe : nav bar, bouton action… (optionnel) */
  footer?: React.ReactNode;
  /** Zone défilante : ScrollView ou FlatList */
  children: React.ReactNode;
  /** Style supplémentaire sur le conteneur racine */
  style?: ViewStyle;
}

/**
 * Mise en page universelle LASSİ :
 *   - header fixe en haut (ne défile jamais)
 *   - children défilants au milieu (flex:1)
 *   - footer fixe en bas (optionnel)
 *   - fondu #14152A→transparent superposé en haut de la zone défilante
 *
 * Le fondu est rendu EN DERNIER dans l'arbre JSX → peint par-dessus
 * la FlatList/ScrollView native sur iOS sans zIndex hack.
 */
export default function LassiScreen({ header, footer, children, style }: Props) {
  const [headerH, setHeaderH] = useState(0);

  return (
    <View style={[s.root, style]}>
      {/* ── Header fixe ──────────────────────────────────────────────────── */}
      <View onLayout={e => setHeaderH(e.nativeEvent.layout.height)}>
        {header}
      </View>

      {/* ── Contenu défilant ─────────────────────────────────────────────── */}
      <View style={s.content}>
        {children}
      </View>

      {/* ── Footer fixe (optionnel) ──────────────────────────────────────── */}
      {footer}

      {/* ── Fondu haut — rendu après tout le reste → toujours au-dessus ─── */}
      {headerH > 0 && (
        <View style={[s.topFade, { top: headerH }]} pointerEvents="none">
          {TOP_FADE_ROWS}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  topFade: {
    position: 'absolute',
    left:     0,
    right:    0,
    height:   24,
  },
});
