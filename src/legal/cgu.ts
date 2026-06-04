/**
 * legal/cgu.ts — Source unique des Conditions Générales d'Utilisation LASSİ.
 * Pour mettre à jour le texte, modifier CE fichier uniquement.
 */

export const VERSION = '1.0.0';
export const DATE_MAJ = '02 juin 2026';

export interface Section {
  titre: string;
  contenu: string;
}

export const CGU_SECTIONS: Section[] = [
  {
    titre: '1. Présentation',
    contenu:
      "LASSİ est une plateforme mobile d'intermédiation économique qui met en relation les habitants de Dakar avec les commerçants et prestataires de leur quartier (restaurants, tanganas, coiffeurs, boutiques, salles de sport, etc.).\n\nLa plateforme est éditée par [À COMPLÉTER — raison sociale], Entreprise Individuelle, au capital de [À COMPLÉTER], immatriculée au RCCM de Dakar sous le numéro [À COMPLÉTER], NINEA [À COMPLÉTER], dont le siège social est situé à Dakar-Guédiawaye, Sénégal.\n\nContact : WhatsApp +221 76 189 00 03 · E-mail : lassiapp33@gmail.com.",
  },
  {
    titre: '2. Objet et acceptation',
    contenu:
      "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de l'application mobile LASSİ (« l'Application »).\n\nEn créant un compte ou en utilisant l'Application, l'utilisateur reconnaît avoir lu, compris et accepté sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous devez cesser d'utiliser l'Application.",
  },
  {
    titre: '3. Accès au service',
    contenu:
      "L'Application est accessible gratuitement à toute personne physique majeure disposant d'un smartphone compatible et d'une connexion Internet.\n\nLASSİ se réserve le droit de suspendre ou de clôturer l'accès à tout compte en cas de violation des présentes CGU, de comportement frauduleux ou de mise en danger d'autres utilisateurs.",
  },
  {
    titre: '4. Création de compte',
    contenu:
      "Pour utiliser l'Application, l'utilisateur doit créer un compte en renseignant son numéro de téléphone sénégalais, qui sert d'identifiant unique.\n\nL'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour. Il est seul responsable de la confidentialité de ses identifiants de connexion et de toutes les actions effectuées depuis son compte.\n\nUn seul compte est autorisé par personne. La création de comptes multiples à des fins frauduleuses est strictement interdite.",
  },
  {
    titre: '5. Utilisation de la plateforme',
    contenu:
      "L'utilisateur s'engage à utiliser l'Application conformément à sa destination et aux lois en vigueur au Sénégal.\n\nIl est notamment interdit de :\n• Publier des contenus illicites, diffamatoires, trompeurs ou portant atteinte aux droits des tiers ;\n• Tenter de contourner les systèmes de sécurité de l'Application ;\n• Utiliser l'Application à des fins de démarchage commercial non autorisé ;\n• Usurper l'identité d'un autre utilisateur ou d'un commerçant.\n\nLASSİ peut retirer tout contenu non conforme sans préavis.",
  },
  {
    titre: '6. Commandes et paiements',
    contenu:
      "Les commandes passées via l'Application constituent un contrat de vente directement entre le client et le commerçant. LASSİ intervient en tant qu'intermédiaire technique et ne saurait être tenu responsable de l'exécution de la prestation.\n\nLes modes de paiement acceptés sont définis dans l'Application (Wave, Orange Money, etc.). Les transactions sont sécurisées par les prestataires de paiement partenaires.\n\nEn cas de litige sur une commande, le client peut contacter le service client LASSİ via WhatsApp au +221 76 189 00 03.",
  },
  {
    titre: '7. Commission et tarification',
    contenu:
      "LASSİ prélève une commission de 0,5 % sur chaque transaction effectuée par l'intermédiaire de la plateforme. Cette commission est à la charge du commerçant et est déduite automatiquement du montant reversé.\n\nLes tarifs d'abonnement éventuels pour les commerçants sont définis dans l'espace commerçant de l'Application et peuvent être modifiés avec un préavis de 30 jours.",
  },
  {
    titre: '8. Obligations des commerçants',
    contenu:
      "Le commerçant inscrit sur LASSİ s'engage à :\n• Fournir des informations exactes sur son établissement, ses produits et services ;\n• Respecter les prix et conditions affichés sur l'Application ;\n• Honorer les commandes confirmées dans les délais annoncés ;\n• Respecter la législation sénégalaise en vigueur (hygiène, licences, fiscalité) ;\n• Ne pas proposer de produits ou services illicites.\n\nLASSİ se réserve le droit de suspendre ou de désactiver le compte d'un commerçant en cas de manquement constaté.",
  },
  {
    titre: '9. Responsabilité',
    contenu:
      "LASSİ met tout en œuvre pour assurer la disponibilité de l'Application, mais ne peut garantir un accès ininterrompu. Des interruptions pour maintenance ou en cas de force majeure peuvent survenir.\n\nLASSİ ne saurait être tenu responsable des dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser l'Application, ni des actes, produits ou services des commerçants référencés.\n\nLa responsabilité de LASSİ est en tout état de cause limitée au montant des transactions effectivement traitées par la plateforme dans les 30 jours précédant l'événement dommageable.",
  },
  {
    titre: '10. Propriété intellectuelle',
    contenu:
      "L'ensemble des éléments de l'Application (logo, marque LASSİ, graphismes, contenus, code source) sont protégés par le droit de la propriété intellectuelle et appartiennent à LASSİ ou à ses partenaires.\n\nToute reproduction, représentation ou utilisation sans autorisation préalable est strictement interdite.",
  },
  {
    titre: '11. Modification des CGU',
    contenu:
      "LASSİ se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification par notification dans l'Application ou par e-mail. La poursuite de l'utilisation de l'Application après notification vaut acceptation des nouvelles CGU.",
  },
  {
    titre: '12. Droit applicable et litiges',
    contenu:
      "Les présentes CGU sont régies par le droit sénégalais. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord, le litige sera soumis aux tribunaux compétents de Dakar, Sénégal.",
  },
];
