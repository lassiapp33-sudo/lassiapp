// Tokens visuels du module VIP 5 Étoiles.
// Source de vérité : maquettes HTML lassi-5etoiles-07-palais.html et 08-maison-or.html.
// NE PAS DÉVIER de ces valeurs sans justification contrainte React Native.
//
// Trois règles non négociables :
//  1. L'or est un filet, jamais une lumière — pas de dégradé brillant, pas d'ombre colorée.
//  2. orLassi (#F5C842) n'apparaît QUE sur le bouton d'action principal.
//  3. Aucune animation sur la fiche royale (pas de Animated, shimmer, pulsation).

export const royal = {
  couleur: {
    encre:    '#070B1C',              // fond principal
    velours:  '#0E1530',              // panneau/portique
    or:       '#C9A227',              // filets et traits gravés
    orClair:  '#EBD28A',              // texte fin, capitales or
    orLassi:  '#F5C842',              // charte LASSI — bouton d'action UNIQUEMENT
    ivoire:   '#EDE8DA',              // texte corps
    gris:     '#8E93AB',              // texte secondaire, fermé
    vert:     '#7FCF9C',              // statut "Ouvert"
    filet:    'rgba(201,162,39,0.34)',
    filetFin: 'rgba(201,162,39,0.14)',
  },

  police: {
    titre:   'Cinzel_500Medium',      // h1, h2, h3 — gabarit palais
    titreM:  'Marcellus_400Regular',  // h1, h2, h3 — gabarit maison
    corps:   'EBGaramond_400Regular',
    corpsIt: 'EBGaramond_400Regular_Italic',
    util:    'Inter_400Regular',
  },

  // "Small caps espacés" — style récurrent sur toutes les fiches.
  // Utilisation : <Text style={royal.caps}>ÉTABLISSEMENT 5 ÉTOILES</Text>
  caps: {
    fontFamily:    'Inter_400Regular',
    fontSize:      9.5,
    letterSpacing: 3.2,
    textTransform: 'uppercase' as const,
    color:         '#EBD28A',
  },

  espace: {
    xs:  6,
    sm: 12,
    md: 20,
    lg: 26,
    xl: 34,
  },
} as const;
