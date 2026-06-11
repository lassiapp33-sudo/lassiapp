/**
 * legal/confidentialite.ts — Source unique de la Politique de confidentialité LASSİ.
 * Pour mettre à jour le texte, modifier CE fichier uniquement.
 *
 * ⚠️  Avant publication définitive, le document doit être validé par un juriste
 *     sénégalais et déclaré à la CDP (Commission de Protection des Données Personnelles).
 */

export const VERSION = '1.1.0';
export const DATE_MAJ = '11 juin 2026';

export interface Section {
  titre: string;
  contenu: string;
}

export const CONFIDENTIALITE_SECTIONS: Section[] = [
  {
    titre: '1. Introduction',
    contenu:
      "La présente Politique de Confidentialité décrit comment LASSİ (« nous », « l'Application ») collecte, utilise, protège et partage les données personnelles de ses utilisateurs (« vous »).\n\n" +
      'Responsable du traitement : COULIBALY LASSANA, Entreprise Individuelle exerçant sous le nom commercial « LASSI » — NINEA : 013082079 — RCCM : SN DKR 2026 A 19335 — Adresse : Guédiawaye Golf Sud Fith Mith, Dakar, Sénégal.\n\n' +
      'Nous nous engageons à protéger votre vie privée conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, sous le contrôle de la Commission de Protection des Données Personnelles (CDP) du Sénégal.\n\n' +
      'En utilisant LASSİ, vous consentez aux pratiques décrites dans la présente politique.',
  },
  {
    titre: '2. Données que nous collectons',
    contenu:
      'Nous collectons uniquement les données nécessaires au fonctionnement du service.\n\n' +
      'Données que vous nous fournissez :\n' +
      '• Numéro de téléphone (identifiant principal)\n' +
      '• Nom / prénom (ou nom du commerce pour les Prestataires)\n' +
      '• Adresse email (optionnelle)\n' +
      '• Pour les Prestataires : nom du commerce, catégorie, zone, numéro marchand Wave/OM, photos (logo, produits, vitrine)\n' +
      '• Contenus que vous publiez (descriptions, avis, messages)\n\n' +
      'Données collectées automatiquement :\n' +
      '• Position géographique (avec votre autorisation), pour afficher les commerces à proximité\n' +
      "• Données d'utilisation (commandes, favoris, historique de navigation)\n" +
      "• Données techniques (type d'appareil, système d'exploitation, identifiant de notification push)\n\n" +
      'Données de paiement :\n' +
      'Les transactions sont traitées par Wave et Orange Money. Nous ne collectons ni ne stockons vos informations bancaires ou codes secrets. Nous conservons uniquement les références et montants des transactions, à des fins de suivi et de comptabilité.',
  },
  {
    titre: '3. Comment nous utilisons vos données',
    contenu:
      'Nous utilisons vos données pour :\n' +
      '• Créer et gérer votre compte\n' +
      '• Vous mettre en relation avec les commerces de proximité (Clients) ou les clients (Prestataires)\n' +
      '• Traiter vos commandes et faciliter les paiements\n' +
      '• Afficher les commerces proches de votre position\n' +
      '• Vous envoyer des notifications utiles (statut de commande, messages, annonces)\n' +
      '• Calculer les classements et recommandations\n' +
      '• Assurer la sécurité, prévenir la fraude et les abus\n' +
      '• Gérer les litiges\n' +
      '• Respecter nos obligations légales et comptables\n' +
      "• Améliorer l'Application\n\n" +
      'Bases légales : exécution du contrat (CGU), consentement (géolocalisation, notifications), intérêt légitime (sécurité, amélioration), obligations légales.',
  },
  {
    titre: '4. Géolocalisation',
    contenu:
      "La position géographique n'est collectée qu'avec votre autorisation explicite (via les réglages de votre appareil).\n\n" +
      'Elle sert exclusivement à vous montrer les commerces à proximité, calculer les distances, et (pour les Prestataires) géolocaliser leur boutique sur la carte.\n\n' +
      'Vous pouvez désactiver la géolocalisation à tout moment dans les réglages de votre téléphone. Certaines fonctionnalités (carte, commerces proches) seront alors limitées.',
  },
  {
    titre: '5. Partage des données',
    contenu:
      'Nous ne vendons jamais vos données personnelles.\n\n' +
      'Nous partageons certaines données uniquement dans les cas suivants :\n' +
      "• Avec les autres utilisateurs, dans le cadre du service : un Prestataire voit le nom et la commande d'un Client qui commande chez lui ; un Client voit les informations publiques d'un Prestataire.\n" +
      '• Avec les opérateurs de paiement (Wave, Orange Money) pour traiter les transactions.\n' +
      '• Avec nos prestataires techniques (hébergement Supabase, notifications), tenus à la confidentialité, uniquement pour faire fonctionner le service.\n' +
      "• Avec les autorités, si la loi l'exige (réquisition judiciaire, obligation légale).",
  },
  {
    titre: '6. Conservation des données',
    contenu:
      'Nous conservons vos données aussi longtemps que votre compte est actif et tant que nécessaire pour fournir le service.\n\n' +
      'En cas de suppression de votre compte, vos données personnelles sont supprimées ou anonymisées, sauf les données que nous devons légalement conserver (ex : pièces comptables relatives aux transactions — 10 ans).\n\n' +
      "Le numéro de téléphone et l'email sont libérés après suppression du compte, permettant une réinscription ultérieure.",
  },
  {
    titre: '7. Sécurité des données',
    contenu:
      'Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :\n' +
      '• Chiffrement des communications (HTTPS/TLS)\n' +
      "• Contrôle d'accès strict (chaque utilisateur n'accède qu'à ses propres données)\n" +
      '• Stockage sécurisé, mots de passe chiffrés\n' +
      '• Surveillance et prévention des accès non autorisés\n\n' +
      "Aucun système n'étant infaillible, nous ne pouvons garantir une sécurité absolue. Vous êtes responsable de la confidentialité de vos identifiants.",
  },
  {
    titre: '8. Vos droits',
    contenu:
      'Conformément à la loi n° 2008-12, vous disposez des droits suivants :\n' +
      "• Droit d'accès : savoir quelles données nous détenons sur vous\n" +
      '• Droit de rectification : corriger des données inexactes\n' +
      "• Droit de suppression : demander l'effacement de vos données (via la suppression de compte dans l'app, ou en nous contactant)\n" +
      "• Droit d'opposition : vous opposer à certains traitements\n" +
      '• Droit de retrait du consentement : à tout moment (désactiver géolocalisation, notifications)\n\n' +
      'Pour exercer ces droits, contactez-nous via WhatsApp au +221 76 189 00 03 ou par e-mail à lassiapp33@gmail.com. Vous pouvez également saisir la CDP (Commission de Protection des Données Personnelles du Sénégal).',
  },
  {
    titre: '9. Notifications',
    contenu:
      "Avec votre consentement, LASSİ vous envoie des notifications (push, in-app) relatives à vos commandes, messages, et annonces de l'Application.\n\n" +
      "Vous pouvez gérer vos préférences de notification dans les réglages de l'Application ou de votre appareil.",
  },
  {
    titre: '10. Mineurs',
    contenu:
      "L'Application est réservée aux personnes âgées d'au moins 18 ans, ou disposant de l'autorisation d'un représentant légal.\n\n" +
      'Nous ne collectons pas sciemment de données de mineurs sans cette autorisation.',
  },
  {
    titre: '11. Cookies et traceurs',
    contenu:
      "L'Application peut utiliser des technologies de stockage local (ex : pour vous garder connecté, mémoriser vos préférences). Elle n'utilise pas de cookies publicitaires tiers.\n\n" +
      "LASSİ ne diffuse pas de publicité tierce dans l'Application.",
  },
  {
    titre: '12. Transferts de données',
    contenu:
      "Vos données sont traitées principalement au Sénégal. Si certains prestataires techniques (ex : hébergement Supabase) sont situés à l'étranger, nous veillons à ce que des garanties appropriées protègent vos données conformément à la loi sénégalaise.",
  },
  {
    titre: '13. Modifications de la politique',
    contenu:
      "Nous pouvons mettre à jour cette politique. Toute modification importante vous sera notifiée via l'Application.\n\n" +
      'La date de dernière mise à jour figure en haut de cet écran.',
  },
  {
    titre: '14. Contact',
    contenu:
      'Pour toute question relative à la protection de vos données :\n' +
      '• WhatsApp : +221 76 189 00 03\n' +
      '• E-mail : lassiapp33@gmail.com\n' +
      '• Adresse : Guédiawaye Golf Sud Fith Mith, Dakar, Sénégal\n\n' +
      'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission de Protection des Données Personnelles (CDP) du Sénégal.',
  },
];
