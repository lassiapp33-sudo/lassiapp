// Catalogue des messages système du kit "Annonces LASSI" (cf.
// AnnonceModal + useAnnonces). Chaque template décrit le contenu par
// défaut d'une annonce ; les placeholders {xxx} sont remplacés via
// renderAnnonceTemplate() au moment de la création de la ligne `annonces`
// (admin manuel ou futur déclencheur pg_cron/trigger).

export type AnnonceAudience = 'tous' | 'prestataires' | 'clients';

export interface AnnonceTemplate {
  titre: string;
  corps: string;
  icone: string;
  tag: string;
  audience: AnnonceAudience;
}

export type AnnonceTemplateKey =
  | 'TOP3_SEMAINE_RESULTATS'
  | 'TOP3_SEMAINE_PODIUM_PRESTATAIRE'
  | 'TOP40_MOIS_RESULTATS'
  | 'TOP40_MOIS_PRESTATAIRE'
  | 'NOUVEAU_CYCLE_CLASSEMENT'
  | 'TOP_QUARTIER_ACTIF'
  | 'OFFRE_ACTIVEE'
  | 'OFFRE_EXPIRE_BIENTOT'
  | 'OFFRE_EXPIREE'
  | 'WAVE_ACTIF'
  | 'BIENVENUE_CLIENT'
  | 'BIENVENUE_PRESTATAIRE'
  | 'MISE_A_JOUR'
  | 'MAINTENANCE';

export const ANNONCE_TEMPLATES: Record<AnnonceTemplateKey, AnnonceTemplate> = {
  TOP3_SEMAINE_RESULTATS: {
    titre: '🏆 Résultats du Top 3 de la semaine',
    corps: 'Le classement hebdomadaire de ta sous-catégorie vient d\'être publié. Découvre le podium dans "Classement".',
    icone: '🏆',
    tag: 'classement',
    audience: 'tous',
  },
  TOP3_SEMAINE_PODIUM_PRESTATAIRE: {
    titre: '🎉 Tu es sur le podium !',
    corps: 'Félicitations, tu termines {rang}ᵉ de ta sous-catégorie cette semaine. Continue sur cette lancée !',
    icone: '🎉',
    tag: 'classement',
    audience: 'prestataires',
  },
  TOP40_MOIS_RESULTATS: {
    titre: '🌍 Résultats du Top 40 du mois',
    corps: 'Le classement mondial du mois de {periode} est disponible. Découvre les 40 meilleurs prestataires de LASSI.',
    icone: '🌍',
    tag: 'classement',
    audience: 'tous',
  },
  TOP40_MOIS_PRESTATAIRE: {
    titre: '🥇 Tu fais partie du Top 40 !',
    corps: 'Bravo, tu termines {rang}ᵉ au classement mondial de {periode}. Ton profil gagne en visibilité auprès de tous les clients.',
    icone: '🥇',
    tag: 'classement',
    audience: 'prestataires',
  },
  NOUVEAU_CYCLE_CLASSEMENT: {
    titre: '🔄 Nouveau cycle de classement',
    corps: 'Une nouvelle semaine de classement commence ! Tes points repartent à zéro — c\'est le moment de viser le podium.',
    icone: '🔄',
    tag: 'classement',
    audience: 'prestataires',
  },
  TOP_QUARTIER_ACTIF: {
    titre: '📍 Top de ton quartier',
    corps: 'Le classement des meilleurs prestataires de ton quartier vient d\'être mis à jour. Va voir qui est en tête !',
    icone: '📍',
    tag: 'classement',
    audience: 'clients',
  },
  OFFRE_ACTIVEE: {
    titre: '✨ Offre du Quartier activée',
    corps: 'Tu as droit à {nbProduits} emplacement{plurielProduits} dans le carrousel "Offre du Quartier". Choisis tes produits pour gagner en visibilité.',
    icone: '✨',
    tag: 'offre',
    audience: 'prestataires',
  },
  OFFRE_EXPIRE_BIENTOT: {
    titre: '⏳ Ton offre expire bientôt',
    corps: 'Ta place dans "Offre du Quartier" expire dans {jours} jour{plurielJours}. Profite des derniers jours de visibilité !',
    icone: '⏳',
    tag: 'offre',
    audience: 'prestataires',
  },
  OFFRE_EXPIREE: {
    titre: '📭 Ton offre a expiré',
    corps: 'Ta place dans "Offre du Quartier" est arrivée à expiration. Continue de progresser dans le classement pour y revenir !',
    icone: '📭',
    tag: 'offre',
    audience: 'prestataires',
  },
  WAVE_ACTIF: {
    titre: '💳 Paiement Wave / Orange Money disponible',
    corps: 'Tu peux désormais payer directement dans l\'app via Wave ou Orange Money. Rapide, sécurisé, sans espèces.',
    icone: '💳',
    tag: 'paiement',
    audience: 'tous',
  },
  BIENVENUE_CLIENT: {
    titre: '👋 Bienvenue sur LASSI !',
    corps: 'LASSI te connecte aux commerces et prestataires de ton quartier à Dakar : explore, commande en quelques clics, suis ta commande en direct, discute avec le commerçant et cumule des points pour grimper dans le classement "Top clients".',
    icone: '👋',
    tag: 'bienvenue',
    audience: 'clients',
  },
  BIENVENUE_PRESTATAIRE: {
    titre: '🎁 Bienvenue sur LASSI !',
    corps: 'Pour démarrer, tu reçois 4 emplacements offerts dans le carrousel "Offre du Quartier" pour mettre en avant tes produits auprès de tous les clients.',
    icone: '🎁',
    tag: 'bienvenue',
    audience: 'prestataires',
  },
  MISE_A_JOUR: {
    titre: '🆕 Nouveautés LASSI',
    corps: '{message}',
    icone: '🆕',
    tag: 'mise-a-jour',
    audience: 'tous',
  },
  MAINTENANCE: {
    titre: '🛠️ Maintenance prévue',
    corps: '{message}',
    icone: '🛠️',
    tag: 'maintenance',
    audience: 'tous',
  },
};

/**
 * Remplace les placeholders {xxx} d'un template par les valeurs fournies.
 * Les clés absentes de `vars` sont laissées telles quelles.
 */
export function renderAnnonceTemplate(
  key: AnnonceTemplateKey,
  vars: Record<string, string | number> = {},
): AnnonceTemplate {
  const tpl = ANNONCE_TEMPLATES[key];
  const replace = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));
  return { ...tpl, titre: replace(tpl.titre), corps: replace(tpl.corps) };
}
