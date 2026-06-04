export interface FaqItem {
  id: number;
  categorie: string;
  question: string;
  motsCles: string[];
  reponse: string;
  profil: 'client' | 'prestataire' | 'tous';
}

export const FAQ_ITEMS: FaqItem[] = [
  // ── COMMANDES ────────────────────────────────────────────────────────────────
  {
    id: 1,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment passer une commande ?',
    motsCles: ['commander', 'acheter', 'passer commande', 'commande', 'commander comment'],
    reponse:
      'Ouvre la vitrine du commerçant, choisis tes produits, ajoute au panier, valide. Choisis "Sur place" ou "À emporter" (pour la nourriture), paie via Wave ou Orange Money, et c\'est fait ! 🐝 Le commerçant reçoit ta commande directement.',
  },
  {
    id: 2,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment prendre un rendez-vous chez un coiffeur ?',
    motsCles: ['rendez-vous', 'rdv', 'coiffeur reserver', 'reserver', 'reservation'],
    reponse:
      'Sur la vitrine du coiffeur, choisis la prestation, puis "Prendre rendez-vous". Tu vois ses disponibilités et tu confirmes. Le salon est prévenu automatiquement. ✂️',
  },
  {
    id: 3,
    categorie: 'commandes',
    profil: 'client',
    question: "Comment m'abonner à une salle de sport ?",
    motsCles: ['abonnement', 'salle de sport', 's abonner', 'formule', 'abonner sport'],
    reponse:
      'Va sur la vitrine de la salle, choisis une formule (mensuel, trimestriel...), clique "S\'abonner", paie via Wave/Orange Money. Ton abonnement est actif. 💪',
  },
  {
    id: 4,
    categorie: 'commandes',
    profil: 'client',
    question: 'Puis-je annuler une commande ?',
    motsCles: ['annuler', 'annulation', 'supprimer commande', 'annuler commande'],
    reponse:
      'Tant que le commerçant n\'a pas confirmé, tu peux annuler depuis "Mes commandes". Une fois confirmée, contacte-le via le chat ou le service client.',
  },
  {
    id: 5,
    categorie: 'commandes',
    profil: 'client',
    question: 'Où voir mes commandes en cours ?',
    motsCles: ['mes commandes', 'suivre commande', 'historique commandes', 'voir commandes'],
    reponse:
      'Dans l\'onglet "Mes commandes" de ton profil : tu vois le statut de chacune en temps réel. ✅',
  },
  {
    id: 6,
    categorie: 'commandes',
    profil: 'client',
    question: 'Différence entre "Sur place" et "À emporter" ?',
    motsCles: ['sur place', 'a emporter', 'emporter', 'difference sur place'],
    reponse:
      '"Sur place" = tu consommes chez le commerçant. "À emporter" = tu récupères pour partir. Cette option n\'apparaît que pour la nourriture.',
  },
  {
    id: 7,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment recommander la même chose ?',
    motsCles: [
      'recommander',
      'reorder',
      'a nouveau',
      'meme commande',
      'refaire',
      'commander a nouveau',
    ],
    reponse:
      'Dans "Mes commandes", sur une commande passée, clique "Commander à nouveau" : tout est repris en un tap. Pratique pour ton tangana de tous les jours ! 🍵',
  },
  {
    id: 8,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment savoir si ma commande est prête ?',
    motsCles: ['prete', 'statut commande', 'pret', 'commande prete', 'quand prete'],
    reponse:
      'Le statut de ta commande se met à jour en temps réel dans "Mes commandes", et tu reçois une notification quand le commerçant la confirme/prépare. 🔔',
  },
  {
    id: 9,
    categorie: 'commandes',
    profil: 'client',
    question: "Puis-je commander pour quelqu'un d'autre ?",
    motsCles: ['commander pour', 'cadeau', 'autre personne', 'quelqu un d autre'],
    reponse:
      "Oui ! Tu commandes normalement, et tu peux préciser au commerçant via le chat si c'est pour une autre personne ou une adresse différente.",
  },
  {
    id: 10,
    categorie: 'commandes',
    profil: 'client',
    question: 'Y a-t-il un minimum de commande ?',
    motsCles: ['minimum', 'montant minimum', 'commande minimum', 'prix minimum'],
    reponse:
      'Ça dépend du commerçant. Certains fixent un minimum, indiqué sur leur vitrine. Sinon, tu commandes ce que tu veux.',
  },

  // ── PAIEMENT ─────────────────────────────────────────────────────────────────
  {
    id: 11,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Comment je paie sur LASSİ ?',
    motsCles: ['payer', 'paiement', 'moyen de paiement', 'comment payer'],
    reponse:
      "Avec Wave ou Orange Money, directement dans l'app. Rapide, sécurisé, confirmation immédiate. 💳",
  },
  {
    id: 12,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Le paiement est-il sécurisé ?',
    motsCles: ['securite paiement', 'securise', 'arnaque paiement', 'fiable paiement'],
    reponse:
      'Oui. Les paiements passent par Wave et Orange Money qui gèrent la sécurité bancaire. LASSİ ne stocke jamais tes infos bancaires. 🛡️',
  },
  {
    id: 13,
    categorie: 'paiement',
    profil: 'tous',
    question: "C'est quoi la commission de LASSİ ?",
    motsCles: ['commission', 'frais', 'pourcentage', 'naata commission', 'ñaata commission'],
    reponse:
      'Une petite commission de 0,5% sur chaque achat validé. Minime, et ça fait vivre la plateforme. Le commerçant reçoit le reste. 🐝',
  },
  {
    id: 14,
    categorie: 'paiement',
    profil: 'tous',
    question: "Est-ce que je paie pour utiliser l'app ?",
    motsCles: ['gratuit', 'payant', 'cout utilisation', 'app gratuite'],
    reponse:
      "Non, l'app est 100% gratuite pour les clients ! Tu paies seulement tes achats. Pas de frais cachés.",
  },
  {
    id: 15,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Paiement débité mais pas de confirmation ?',
    motsCles: ['pas recu', 'probleme paiement', 'echoue', 'debite sans confirmation'],
    reponse:
      'Vérifie "Mes commandes". Si tu as été débité sans que rien n\'apparaisse, contacte le service client avec ta capture Wave/OM, on règle vite.',
  },
  {
    id: 16,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Puis-je être remboursé ?',
    motsCles: ['remboursement', 'rembourser', 'retour argent', 'remboursé'],
    reponse:
      'En cas de problème, contacte le commerçant via le chat ou le service client. Les remboursements sont traités au cas par cas.',
  },
  {
    id: 17,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Puis-je payer en espèces ?',
    motsCles: ['especes', 'cash', 'liquide', 'main a main', 'payer cash'],
    reponse:
      'LASSİ privilégie Wave/OM pour la sécurité. Pour un paiement en espèces sur place, arrange-toi directement avec le commerçant (hors app).',
  },
  {
    id: 18,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Où voir mes reçus / paiements ?',
    motsCles: ['recu', 'recus', 'historique paiement', 'facture'],
    reponse:
      'Tes paiements apparaissent dans ton historique de commandes. (Un espace "Mes reçus" dédié arrive bientôt.)',
  },

  // ── COMPTE ───────────────────────────────────────────────────────────────────
  {
    id: 19,
    categorie: 'compte',
    profil: 'tous',
    question: 'Comment créer un compte ?',
    motsCles: ['creer compte', 'inscription', 's inscrire', 'ouvrir compte', 'nouveau compte'],
    reponse:
      'Entre ton numéro (+221), choisis client ou prestataire, complète ton profil. Simple et rapide ! 📱',
  },
  {
    id: 20,
    categorie: 'compte',
    profil: 'tous',
    question: "J'ai changé de numéro de téléphone ?",
    motsCles: ['changer numero', 'nouveau numero', 'modifier telephone', 'changement numero'],
    reponse:
      'Profil → Paramètres → Modifier mes infos. Pour le numéro lié au compte, contacte le service client pour sécuriser la transition.',
  },
  {
    id: 21,
    categorie: 'compte',
    profil: 'tous',
    question: 'Comment modifier mon profil ?',
    motsCles: ['modifier profil', 'changer infos', 'photo profil', 'changer nom'],
    reponse: 'Onglet Profil → "Modifier". Change ta photo, ton nom, tes infos. Enregistre. ✏️',
  },
  {
    id: 22,
    categorie: 'compte',
    profil: 'tous',
    question: 'Comment supprimer mon compte ?',
    motsCles: ['supprimer compte', 'fermer compte', 'effacer compte', 'desactiver compte'],
    reponse:
      "Profil → Paramètres → Supprimer mon compte. Action définitive. Contacte-nous avant si tu hésites, on peut t'aider.",
  },
  {
    id: 23,
    categorie: 'compte',
    profil: 'tous',
    question: 'Problème de connexion ?',
    motsCles: [
      'connexion',
      'se connecter',
      'n arrive pas',
      'connexion impossible',
      'probleme connexion',
    ],
    reponse:
      'Reconnecte-toi avec ton numéro (+221). Vérifie ta connexion internet. Toujours bloqué ? Contacte le service client.',
  },
  {
    id: 24,
    categorie: 'compte',
    profil: 'tous',
    question: 'Comment gérer mes favoris ?',
    motsCles: ['favoris', 'enregistrer', 'coeur', 'sauvegarder', 'ajouter favoris'],
    reponse: "Clique sur le cœur ❤️ sur une vitrine. Retrouve tout dans l'onglet Favoris.",
  },
  {
    id: 25,
    categorie: 'compte',
    profil: 'tous',
    question: 'Mes données sont-elles en sécurité ?',
    motsCles: ['donnees', 'confidentialite', 'vie privee', 'protection donnees'],
    reponse:
      'Oui, protégées selon la loi sénégalaise. On ne vend jamais tes données. Voir la Politique de confidentialité dans les paramètres. 🛡️',
  },
  {
    id: 26,
    categorie: 'compte',
    profil: 'tous',
    question: 'Comment changer la langue ?',
    motsCles: ['langue', 'francais', 'wolof', 'changer langue'],
    reponse:
      'Le choix de langue (Français/Wolof) arrive très bientôt dans les paramètres. Reste connecté ! 🌍',
  },

  // ── DEVENIR PRESTATAIRE ───────────────────────────────────────────────────────
  {
    id: 27,
    categorie: 'prestataire',
    profil: 'tous',
    question: 'Comment devenir prestataire ?',
    motsCles: [
      'devenir prestataire',
      'vendre',
      'inscrire commerce',
      'ouvrir boutique',
      'inscription prestataire',
    ],
    reponse:
      'À l\'inscription, choisis "Prestataire". Indique ta catégorie, le nom de ton commerce, ton adresse, ton numéro. Puis crée ta vitrine. Rapide et gratuit ! 🏪',
  },
  {
    id: 28,
    categorie: 'prestataire',
    profil: 'tous',
    question: "Quels commerces peuvent s'inscrire ?",
    motsCles: ['types commerce', 'categories commerces', 'qui peut vendre', 'quels commerces'],
    reponse:
      'Tangana/Ndéki, restos & boissons (fast-food, dibiterie, séraas, jus...), coiffeurs & salons, salles de sport, boulangeries-pâtisseries, commerçants du quartier (alimentation, quincaillerie). 🌟',
  },
  {
    id: 29,
    categorie: 'prestataire',
    profil: 'tous',
    question: 'Est-ce payant pour les prestataires ?',
    motsCles: [
      'prestataire payant',
      'cout prestataire',
      'forfait prestataire',
      'inscription gratuite',
    ],
    reponse:
      "L'inscription est gratuite. LASSİ se rémunère via la commission de 0,5%. Des forfaits de visibilité optionnels existent.",
  },
  {
    id: 30,
    categorie: 'prestataire',
    profil: 'tous',
    question: 'Combien de temps pour être visible ?',
    motsCles: ['visible', 'validation', 'apparaitre', 'delai inscription', 'quand visible'],
    reponse:
      'Dès que ta vitrine est créée et tes infos remplies, ton commerce apparaît pour les clients. Quasi immédiat ! ⚡',
  },

  // ── ESPACE PRESTATAIRE ────────────────────────────────────────────────────────
  {
    id: 31,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment créer ou modifier ma vitrine ?',
    motsCles: ['vitrine', 'ma boutique', 'gerer vitrine', 'creer vitrine', 'modifier vitrine'],
    reponse:
      'Va dans "Ma Vitrine". Ajoute produits/services/formules, photos, description, adresse, horaires, numéro. Tout est visible immédiatement. 🛍️',
  },
  {
    id: 32,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment ajouter mes produits ou services ?',
    motsCles: ['ajouter produit', 'ajouter service', 'menu', 'catalogue', 'nouveau produit'],
    reponse:
      'Dans "Ma Vitrine" → "Ajouter". Produits (prix + photo) pour la nourriture/boutique, prestations pour coiffeurs, formules pour le sport.',
  },
  {
    id: 33,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment gérer mes horaires ?',
    motsCles: ['horaires', 'heures ouverture', 'jours ouverture', 'gerer horaires'],
    reponse:
      '"Ma Vitrine" → Horaires. Définis tes heures par jour. Le statut "Ouvert/Fermé" s\'affiche automatiquement. Tu peux aussi activer "Exceptionnellement fermé".',
  },
  {
    id: 34,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Où voir les commandes de mes clients ?',
    motsCles: [
      'commandes recues',
      'voir commandes prestataire',
      'gerer commandes',
      'mes commandes prestataire',
    ],
    reponse:
      'Tableau de bord prestataire → "Commandes". En temps réel : confirme, prépare, marque comme terminé. 📦',
  },
  {
    id: 35,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment je reçois mon argent ?',
    motsCles: [
      'recevoir argent',
      'reversement',
      'encaissement',
      'mon argent',
      'paiement prestataire',
    ],
    reponse:
      "Quand un client paie, l'argent t'est reversé automatiquement sur ton Wave/OM, moins la commission de 0,5%. 💰",
  },
  {
    id: 36,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: "C'est quoi le cahier de dettes ?",
    motsCles: ['dettes', 'cahier de dettes', 'credit', 'ardoise', 'carnet dettes'],
    reponse:
      "Un carnet numérique pour noter les clients qui te doivent de l'argent (le crédit du quartier). Tu suis qui doit quoi, proprement. 📒",
  },
  {
    id: 37,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: "C'est quoi le statut VIP ?",
    motsCles: ['vip', 'podium', 'top commerce', 'mise en avant', 'statut vip'],
    reponse:
      'Le VIP met ton commerce en avant (podium 🥇🥈🥉 de ta catégorie). Il se gagne selon ton activité ; certains forfaits boostent ta visibilité.',
  },
  {
    id: 38,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: "C'est quoi les forfaits mensuels ?",
    motsCles: ['forfait', 'forfait mensuel', 'abonnement visibilite', 'booster', 'forfaits'],
    reponse:
      'Optionnels, ils donnent plus de visibilité (mise en avant, recommandation). Gérés directement entre toi et LASSİ.',
  },
  {
    id: 39,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment créer une promo ?',
    motsCles: ['promo', 'promotion', 'reduction', 'offre', 'solde', 'creer promo'],
    reponse:
      'Dans ton espace prestataire → Promotions, crée une offre ("-20% aujourd\'hui", "2 achetés = 1 offert"). Elle s\'affiche sur ta vitrine pour attirer les clients. 🎉',
  },
  {
    id: 40,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment marquer un produit épuisé ?',
    motsCles: ['epuise', 'rupture', 'stock', 'indisponible', 'plus de stock', 'rupture stock'],
    reponse:
      'Sur le produit dans "Ma Vitrine", active "Indisponible/Épuisé". Les clients voient qu\'il n\'est pas dispo : ça t\'évite des commandes que tu ne peux pas honorer.',
  },
  {
    id: 41,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment voir mes statistiques ?',
    motsCles: ['statistiques', 'stats', 'vues', 'performance', 'top produits'],
    reponse:
      'Les statistiques (vues de ta vitrine, top produits, commandes du mois) arrivent bientôt dans ton espace prestataire. 📊',
  },
  {
    id: 42,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment répondre à un avis client ?',
    motsCles: ['repondre avis', 'commentaire client', 'reponse note', 'avis client'],
    reponse:
      'Quand un client laisse un avis, tu peux y répondre depuis ta vitrine. Une réponse polie rassure les futurs clients ! ⭐',
  },

  // ── MESSAGERIE ────────────────────────────────────────────────────────────────
  {
    id: 43,
    categorie: 'messagerie',
    profil: 'tous',
    question: 'Comment contacter un commerçant ou un client ?',
    motsCles: ['message', 'chat', 'contacter', 'discuter', 'ecrire', 'envoyer message'],
    reponse:
      "Via le chat intégré ! Depuis une vitrine ou une commande, clique l'icône message. Tu reçois une notification à chaque nouveau message. 💬",
  },
  {
    id: 44,
    categorie: 'messagerie',
    profil: 'tous',
    question: 'Je ne reçois pas mes notifications ?',
    motsCles: [
      'notification',
      'pas de notification',
      'alertes',
      'notif',
      'notifications manquantes',
    ],
    reponse:
      'Vérifie que les notifications LASSİ sont activées dans les réglages de ton téléphone, et ta connexion internet. Sinon, service client. 🔔',
  },
  {
    id: 45,
    categorie: 'messagerie',
    profil: 'tous',
    question: 'Puis-je envoyer une photo dans le chat ?',
    motsCles: ['photo chat', 'envoyer image', 'joindre photo', 'image chat'],
    reponse:
      'Oui, tu peux partager des photos dans le chat (ex : montrer un modèle de coupe au coiffeur, un produit au commerçant). 📸',
  },

  // ── AVIS & NOTES ─────────────────────────────────────────────────────────────
  {
    id: 46,
    categorie: 'avis',
    profil: 'tous',
    question: 'Comment laisser un avis ?',
    motsCles: ['avis', 'noter', 'note', 'commentaire', 'evaluer', 'laisser avis'],
    reponse:
      'Après une commande, tu peux donner une note (étoiles) + un commentaire sur le commerçant. Ça aide toute la communauté ! ⭐',
  },
  {
    id: 47,
    categorie: 'avis',
    profil: 'tous',
    question: 'Pourquoi laisser un avis ?',
    motsCles: ['pourquoi avis', 'utilite avis', 'importance note', 'pourquoi noter'],
    reponse:
      "Tes avis aident les autres à choisir et encouragent les bons commerçants. C'est l'esprit communautaire de LASSİ. 🤝",
  },
  {
    id: 48,
    categorie: 'avis',
    profil: 'tous',
    question: 'Que veut dire le badge "Nouveau" ?',
    motsCles: ['badge nouveau', 'nouveau commerce', 'pas d avis', 'badge'],
    reponse:
      'Le badge "Nouveau" signale un commerce qui n\'a pas encore reçu d\'avis. Sois le premier à le tester et à le noter ! 🆕',
  },
  {
    id: 49,
    categorie: 'avis',
    profil: 'tous',
    question: 'Puis-je modifier mon avis ?',
    motsCles: ['modifier avis', 'changer note', 'supprimer avis', 'modifier commentaire'],
    reponse:
      'Oui, tu peux modifier ou retirer ton avis depuis la vitrine concernée ou ton historique.',
  },

  // ── PROBLÈMES & LITIGES ───────────────────────────────────────────────────────
  {
    id: 50,
    categorie: 'litiges',
    profil: 'tous',
    question: 'Comment signaler un problème ?',
    motsCles: ['signaler', 'probleme', 'bug', 'reclamation', 'plainte', 'signalement'],
    reponse:
      'Profil → "Signaler un problème". Décris ton souci, on le traite. Pour une urgence, contacte le service client sur WhatsApp au +221 76 189 00 03.',
  },
  {
    id: 51,
    categorie: 'litiges',
    profil: 'tous',
    question: 'Que faire en cas de litige sur une commande ?',
    motsCles: ['litige', 'desaccord', 'conflit', 'dispute', 'probleme commande'],
    reponse:
      "Contacte d'abord l'autre partie via le chat. Si ça persiste, signale le litige au service client : on examine chaque cas. ⚖️",
  },
  {
    id: 52,
    categorie: 'litiges',
    profil: 'tous',
    question: 'Un commerçant ne répond pas, que faire ?',
    motsCles: ['pas de reponse', 'commercant absent', 'injoignable', 'ne repond pas'],
    reponse:
      'Patiente un peu (il est peut-être occupé). Sans réponse, contacte le service client, surtout si tu as déjà payé.',
  },
  {
    id: 53,
    categorie: 'litiges',
    profil: 'tous',
    question: "J'ai reçu un mauvais produit ou service ?",
    motsCles: ['mauvais produit', 'erreur commande', 'pas conforme', 'decu', 'mauvaise qualite'],
    reponse:
      'Contacte le commerçant via le chat pour trouver une solution. Si rien ne se règle, signale-le au service client.',
  },
  {
    id: 54,
    categorie: 'litiges',
    profil: 'tous',
    question: 'Comment signaler une arnaque ?',
    motsCles: ['arnaque', 'fraude', 'escroquerie', 'voleur', 'signaler arnaque'],
    reponse:
      'Signale immédiatement via "Signaler un problème" ou le service client. La sécurité de la communauté est notre priorité. 🚨',
  },

  // ── RECHERCHE & DÉCOUVERTE ────────────────────────────────────────────────────
  {
    id: 55,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment chercher un commerce ?',
    motsCles: ['chercher', 'rechercher', 'trouver commerce', 'recherche', 'comment chercher'],
    reponse:
      'Tape directement ta demande ici (ex : "coiffeur à Patte d\'Oie"), ou utilise la recherche et les catégories sur l\'accueil. Je te trouve ça ! 🔍',
  },
  {
    id: 56,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment trouver les commerces près de moi ?',
    motsCles: ['pres de moi', 'autour de moi', 'proximite', 'localisation', 'commerces proches'],
    reponse:
      'Active ta localisation, puis "Autour de moi" sur l\'accueil ou la carte. Tu vois les commerces proches avec la distance exacte. 📍',
  },
  {
    id: 57,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment savoir qui est ouvert en ce moment ?',
    motsCles: ['ouvert', 'ouvert maintenant', 'ferme', 'horaires ouverture', 'qui est ouvert'],
    reponse:
      'Utilise "Ouvert maintenant" sur l\'accueil, ou regarde le badge de statut sur chaque vitrine. Les horaires sont en temps réel. 🟢',
  },
  {
    id: 58,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment voir les commerces sur la carte ?',
    motsCles: ['carte', 'map', 'plan', 'geolocalisation', 'voir carte'],
    reponse:
      "Ouvre l'onglet Carte : tous les commerces s'affichent avec des repères, les VIP en doré. Touche un repère pour voir la vitrine. 🗺️",
  },
  {
    id: 59,
    categorie: 'recherche',
    profil: 'tous',
    question: "C'est quoi les sous-catégories ?",
    motsCles: ['sous-categorie', 'filtre', 'type commerce', 'specialite'],
    reponse:
      "Chaque catégorie a des sous-types (ex : Restos → restaurant, fast-food, dibiterie, jus...). Ça t'aide à trouver exactement ce que tu cherches.",
  },
  {
    id: 60,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment trouver un produit précis (ciment, riz...) ?',
    motsCles: ['produit precis', 'ciment', 'riz', 'article', 'trouver produit'],
    reponse:
      'Tape le produit ici (ex : "ciment à Rufisque") : je cherche les commerçants/quincailleries qui en proposent près de la zone. 🔍',
  },

  // ── AUTRES ───────────────────────────────────────────────────────────────────
  {
    id: 61,
    categorie: 'autres',
    profil: 'tous',
    question: "C'est quoi LASSİ ?",
    motsCles: [
      'c est quoi lassi',
      'lassi kesako',
      'a quoi sert',
      'presentation lassi',
      'lassi application',
    ],
    reponse:
      'LASSİ est ton app de proximité à Dakar : elle connecte les clients aux commerçants et prestataires du quartier (restos, tangana, coiffeurs, sport, boutiques...). Découvre, commande et paie facilement près de chez toi ! 🐝',
  },
  {
    id: 62,
    categorie: 'autres',
    profil: 'tous',
    question: 'Qui es-tu, Lassi ?',
    motsCles: ['qui es tu', 'lassi qui', 'mascotte', 'abeille', 'c est qui lassi'],
    reponse:
      "Je suis Lassi, l'abeille assistante de l'app ! 🐝 Je t'aide à trouver des commerces, à comprendre l'app, et à résoudre tes soucis. Pose-moi tes questions !",
  },
  {
    id: 63,
    categorie: 'autres',
    profil: 'tous',
    question: 'Comment contacter le service client ?',
    motsCles: [
      'service client',
      'support',
      'aide',
      'assistance',
      'numero service client',
      'contacter lassi',
    ],
    reponse:
      'Le service client est disponible sur WhatsApp au +221 76 189 00 03. Appuie sur le bouton "Contacter le service client" ci-dessous pour nous écrire directement ! 💬',
  },
  {
    id: 64,
    categorie: 'autres',
    profil: 'tous',
    question: "L'app marche-t-elle hors connexion ?",
    motsCles: ['hors ligne', 'sans internet', 'offline', 'sans connexion'],
    reponse:
      'Certaines fonctions (favoris, profil) marchent hors-ligne, mais commander, payer et discuter nécessitent internet.',
  },
  {
    id: 65,
    categorie: 'autres',
    profil: 'tous',
    question: 'Dans quelles villes LASSİ est disponible ?',
    motsCles: ['ville', 'disponible', 'zone lassi', 'dakar', 'regions', 'ou disponible'],
    reponse:
      "LASSİ démarre à Dakar et s'étendra à d'autres villes du Sénégal progressivement. Reste connecté ! 🇸🇳",
  },
  {
    id: 66,
    categorie: 'autres',
    profil: 'tous',
    question: 'Comment proposer une idée ou un retour ?',
    motsCles: ['suggestion', 'idee', 'retour', 'feedback', 'ameliorer', 'proposer idee'],
    reponse:
      'On adore les retours ! Passe par "Signaler un problème" ou le service client pour partager tes idées. LASSİ grandit avec sa communauté. 💡',
  },
  {
    id: 67,
    categorie: 'autres',
    profil: 'tous',
    question: "L'app est sur iPhone et Android ?",
    motsCles: ['iphone', 'android', 'ios', 'telecharger', 'store', 'play store', 'app store'],
    reponse:
      'Oui, sur Android (Play Store) et iPhone (App Store). Télécharge et profite de ton quartier ! 📲',
  },
  {
    id: 68,
    categorie: 'autres',
    profil: 'tous',
    question: 'Comment inviter des amis ?',
    motsCles: ['inviter', 'parrainage', 'partager', 'ami', 'inviter amis'],
    reponse:
      "Le partage et le parrainage arrivent bientôt ! Tu pourras inviter tes amis et gagner des avantages. Reste à l'écoute. 🎁",
  },
  {
    id: 69,
    categorie: 'autres',
    profil: 'tous',
    question: "C'est quoi la version de l'app ?",
    motsCles: ['version', 'a propos', 'mise a jour', 'version app'],
    reponse:
      "Tu trouves la version de l'app dans Profil → À propos. Pense à garder l'app à jour pour les nouveautés !",
  },
  {
    id: 70,
    categorie: 'autres',
    profil: 'tous',
    question: 'LASSİ est-elle une app sénégalaise ?',
    motsCles: ['senegalaise', 'made in senegal', 'locale', 'origine lassi'],
    reponse:
      'Oui ! LASSİ est pensée et faite pour le Sénégal 🇸🇳, pour valoriser les commerces de quartier et la teranga.',
  },

  // ── WOLOF ─────────────────────────────────────────────────────────────────────
  {
    id: 71,
    categorie: 'wolof',
    profil: 'tous',
    question: 'Naka lañuy commandé ? (Comment commander ?)',
    motsCles: ['naka commande', 'commande naka', 'commandé naka', 'naka lay commande'],
    reponse:
      'Ubbil vitrine bu commerçant bi, tann li nga bëgg, ajouté ko ci panier bi, validé. Feyal ak Wave walla Orange Money. Pare na ! 🐝\n(Ouvre la vitrine, choisis, ajoute au panier, valide et paie via Wave/OM.)',
  },
  {
    id: 72,
    categorie: 'wolof',
    profil: 'tous',
    question: 'Fan la mën gisé coiffeur ? (Où trouver un coiffeur ?)',
    motsCles: ['fan coiffeur', 'coiffeur fan', 'trouver coiffeur wolof', 'fan la gen gise'],
    reponse:
      'Bindal "coiffeur" ak quartier bi (ci misal "coiffeur Patte d\'Oie"), dinaa la wone yi nekk ci wetu yaw. 🐝\n(Tape "coiffeur" + ton quartier, je te montre ceux près de toi.)',
  },
  {
    id: 73,
    categorie: 'wolof',
    profil: 'tous',
    question: "Ñaata la commission bi ? (C'est combien la commission ?)",
    motsCles: ['naata commission', 'commission naata', 'ñaata commission', 'nata commission'],
    reponse:
      "Commission bi 0,5% la rekk ci benn benn achat bu validé. Tuuti la. 🐝\n(La commission est juste 0,5% par achat validé, c'est minime.)",
  },

  // ── PLUS DE QUESTIONS ─────────────────────────────────────────────────────────
  {
    id: 74,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Comment payer avec Wave exactement ?',
    motsCles: ['wave', 'payer wave', 'comment wave', 'paiement wave'],
    reponse:
      'Au paiement, choisis Wave : tu es redirigé vers Wave, tu confirmes, et tu reviens sur LASSİ avec la confirmation. Simple. 🌊',
  },
  {
    id: 75,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Comment payer avec Orange Money ?',
    motsCles: ['orange money', 'om', 'payer om', 'paiement orange money'],
    reponse:
      'Choisis Orange Money au paiement, valide via ton compte OM, et la confirmation revient sur LASSİ. 🟠',
  },
  {
    id: 76,
    categorie: 'prestataire',
    profil: 'tous',
    question: "Mon commerçant préféré n'est pas sur LASSİ ?",
    motsCles: [
      'pas sur lassi',
      'ajouter commercant',
      'mon commercant absent',
      'commercant pas inscrit',
    ],
    reponse:
      "Parle-lui de LASSİ ! Il peut s'inscrire gratuitement comme prestataire en quelques minutes. Plus on est nombreux, mieux c'est. 🙌",
  },
  {
    id: 77,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment fonctionne la distance affichée ?',
    motsCles: ['distance', 'km', 'loin', 'proche', 'calcul distance'],
    reponse:
      'La distance est calculée entre ta position (si activée) et le commerce. Active ta localisation pour des distances précises. 📍',
  },
  {
    id: 78,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Pourquoi activer ma localisation ?',
    motsCles: ['localisation', 'gps', 'position', 'activer localisation', 'pourquoi localisation'],
    reponse:
      'Pour te montrer les commerces les plus proches et calculer les distances. Tes données de position ne sont pas partagées publiquement. 📍',
  },
  {
    id: 79,
    categorie: 'commandes',
    profil: 'tous',
    question: 'Les prix sont-ils fixes ?',
    motsCles: ['prix', 'tarif', 'fixe', 'negocier', 'prix fixes'],
    reponse:
      'Les prix affichés sont fixés par chaque commerçant. Pour une négociation, discute directement avec lui via le chat.',
  },
  {
    id: 80,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment fonctionne le podium VIP ?',
    motsCles: ['podium', 'top 3', 'classement', 'meilleur', 'podium vip'],
    reponse:
      "Chaque catégorie a un podium 🥇🥈🥉 des commerces les plus actifs/appréciés. Ça t'aide à repérer les valeurs sûres du quartier.",
  },
  {
    id: 81,
    categorie: 'recherche',
    profil: 'client',
    question: 'Puis-je suivre un commerçant ?',
    motsCles: ['suivre', 'favori commercant', 'abonner commercant', 'suivre commerce'],
    reponse:
      'Ajoute-le en favori (cœur ❤️) pour le retrouver vite et ne rien rater de ses nouveautés.',
  },
  {
    id: 82,
    categorie: 'recherche',
    profil: 'client',
    question: "Comment voir les nouveautés d'un commerce ?",
    motsCles: ['nouveautes', 'nouveau produit', 'actualite commerce', 'nouveaute commerce'],
    reponse:
      'Visite sa vitrine : ses produits/services et promos y sont à jour. Mets-le en favori pour y revenir facilement.',
  },
  {
    id: 83,
    categorie: 'recherche',
    profil: 'tous',
    question: 'C\'est quoi un commerce "recommandé" ?',
    motsCles: ['recommande', 'reco', 'suggestion', 'mis en avant', 'commerce recommande'],
    reponse:
      "Ce sont des commerces mis en avant par LASSİ (qualité, activité, ou forfait visibilité). Une bonne porte d'entrée pour découvrir. 🌟",
  },
  {
    id: 84,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment annuler un rendez-vous coiffeur ?',
    motsCles: ['annuler rdv', 'annuler rendez-vous', 'decommander', 'annuler reservation'],
    reponse:
      'Depuis "Mes commandes/rendez-vous", annule tant que ce n\'est pas confirmé, ou préviens le salon via le chat.',
  },
  {
    id: 85,
    categorie: 'commandes',
    profil: 'client',
    question: 'Comment annuler un abonnement sport ?',
    motsCles: ['annuler abonnement', 'resilier', 'arreter abonnement', 'annulation abonnement'],
    reponse:
      'Contacte la salle via le chat pour les conditions de résiliation, ou le service client si besoin.',
  },
  {
    id: 86,
    categorie: 'compte',
    profil: 'tous',
    question: 'Mes favoris ont disparu ?',
    motsCles: ['favoris disparu', 'perdu favoris', 'plus de favoris', 'favoris perdus'],
    reponse:
      'Vérifie que tu es bien connecté avec le bon compte. Si le souci persiste, contacte le service client.',
  },
  {
    id: 87,
    categorie: 'compte',
    profil: 'tous',
    question: "L'app est lente, que faire ?",
    motsCles: ['lente', 'lent', 'app lente', 'rame', 'plante', 'bug app'],
    reponse:
      "Vérifie ta connexion, ferme et rouvre l'app, assure-toi qu'elle est à jour. Toujours lent ? Signale-le-nous.",
  },
  {
    id: 88,
    categorie: 'compte',
    profil: 'tous',
    question: "Comment mettre à jour l'app ?",
    motsCles: ['mise a jour', 'mettre a jour', 'update', 'nouvelle version', 'maj app'],
    reponse:
      'Va sur le Play Store / App Store, cherche LASSİ, clique "Mettre à jour" si dispo. Garde l\'app à jour pour les nouveautés. 🔄',
  },
  {
    id: 89,
    categorie: 'compte',
    profil: 'tous',
    question: 'Puis-je utiliser LASSİ sur plusieurs téléphones ?',
    motsCles: [
      'plusieurs telephones',
      'autre telephone',
      'connexion multiple',
      'changer telephone',
    ],
    reponse:
      "Oui, connecte-toi avec ton numéro sur l'appareil de ton choix. Tes données te suivent.",
  },
  {
    id: 90,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment fonctionne le filtre "Ouvert maintenant" ?',
    motsCles: ['ouvert maintenant', 'filtre ouvert', 'ouverts maintenant', 'filtre ouverts'],
    reponse:
      "Ce filtre n'affiche que les commerces ouverts à l'instant, selon leurs horaires déclarés. Pratique quand tu as faim tout de suite ! 🟢",
  },
  {
    id: 91,
    categorie: 'commandes',
    profil: 'client',
    question: 'Que se passe-t-il si je me trompe de commande ?',
    motsCles: ['erreur commande', 'trompe', 'mauvaise commande', 'erreur dans commande'],
    reponse:
      "Si elle n'est pas confirmée, annule-la. Sinon, contacte vite le commerçant via le chat pour ajuster.",
  },
  {
    id: 92,
    categorie: 'autres',
    profil: 'tous',
    question: 'Comment contacter LASSİ pour un partenariat ?',
    motsCles: ['partenariat', 'partenaire', 'business', 'collaboration', 'partenariat lassi'],
    reponse:
      "Pour un partenariat, contacte le service client sur WhatsApp (+221 76 189 00 03) qui transmettra à l'équipe.",
  },
  {
    id: 93,
    categorie: 'autres',
    profil: 'tous',
    question: 'Les commerçants sont-ils vérifiés ?',
    motsCles: ['verifie', 'confiance', 'fiable', 'serieux commercant', 'commercant verifie'],
    reponse:
      "Les commerçants s'inscrivent avec leurs infos réelles. Les avis et le statut VIP t'aident à juger leur sérieux. Signale tout abus. 🛡️",
  },
  {
    id: 94,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Puis-je payer en plusieurs fois ?',
    motsCles: ['plusieurs fois', 'echelonne', 'credit paiement', 'payer en plusieurs fois'],
    reponse:
      'LASSİ ne gère pas le paiement échelonné. Pour un arrangement, vois directement avec le commerçant (ex : via le cahier de dettes).',
  },
  {
    id: 95,
    categorie: 'autres',
    profil: 'client',
    question: 'Comment fonctionne le cahier de dettes côté client ?',
    motsCles: ['dette client', 'je dois', 'credit client', 'dette ardoise'],
    reponse:
      "Le commerçant peut noter ce que tu lui dois (le crédit du quartier). C'est entre toi et lui ; ça garde les choses claires. 📒",
  },
  {
    id: 96,
    categorie: 'autres',
    profil: 'tous',
    question: "C'est quoi un Ndéki ?",
    motsCles: ['ndeki', 'ndekki', 'petit dejeuner senegalais', 'mama ndeki'],
    reponse:
      'Le Ndéki, c\'est le petit-déjeuner sénégalais (souvent chez "Mama") : café touba, mbourou, omelette... Cherche "ndéki" pour en trouver près de toi ! ☕',
  },
  {
    id: 97,
    categorie: 'recherche',
    profil: 'tous',
    question: 'Comment trouver une dibiterie ?',
    motsCles: ['dibiterie', 'dibi', 'viande grillee', 'trouver dibiterie'],
    reponse:
      'Tape "dibiterie" + ton quartier (ex : "dibiterie Médina") et je te montre les dibiteries proches. 🥩',
  },
  {
    id: 98,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'LASSİ prend-elle une commission sur les rendez-vous coiffeur ?',
    motsCles: ['commission coiffeur', 'frais rdv', 'commission service coiffeur'],
    reponse:
      "Le modèle de commission s'applique aux paiements via l'app. Pour les détails par type de service, le commerçant et LASSİ s'arrangent en interne.",
  },
  {
    id: 99,
    categorie: 'messagerie',
    profil: 'tous',
    question: 'Comment supprimer une conversation ?',
    motsCles: [
      'supprimer chat',
      'effacer conversation',
      'supprimer message',
      'supprimer conversation',
    ],
    reponse: 'Dans la messagerie, appuie longuement sur une conversation pour la gérer/supprimer.',
  },
  {
    id: 100,
    categorie: 'paiement',
    profil: 'tous',
    question: 'Mes informations bancaires sont-elles stockées ?',
    motsCles: ['infos bancaires', 'carte', 'donnees paiement', 'stockage bancaire'],
    reponse:
      'Non. LASSİ ne stocke aucune info bancaire. Tout passe par Wave/OM de façon sécurisée. 🔒',
  },
  {
    id: 101,
    categorie: 'espace_prestataire',
    profil: 'prestataire',
    question: 'Comment devenir VIP plus vite ?',
    motsCles: [
      'devenir vip',
      'monter vip',
      'booster visibilite',
      'top rapidement',
      'vip rapidement',
    ],
    reponse:
      "Sois actif : vitrine complète, photos, horaires à jour, bonnes réponses aux clients, bons avis. Un forfait visibilité peut aussi t'aider. 🚀",
  },
];

export const FAQ_CATEGORIES_LABELS: Record<string, string> = {
  commandes: 'Commandes',
  paiement: 'Paiement',
  compte: 'Mon compte',
  prestataire: 'Prestataire',
  espace_prestataire: 'Ma vitrine',
  messagerie: 'Messagerie',
  avis: 'Avis & Notes',
  litiges: 'Litiges',
  recherche: 'Recherche',
  autres: 'Autres',
  wolof: 'Wolof',
};

export function getQuestionsParCategorie(
  cat: string,
  profil: 'client' | 'prestataire' | 'tous',
): FaqItem[] {
  return FAQ_ITEMS.filter(
    f => f.categorie === cat && (f.profil === 'tous' || f.profil === profil),
  ).slice(0, 5);
}

export const SUGGESTIONS_ACCUEIL = [
  'Comment passer une commande ?',
  'Comment trouver un commerce près de moi ?',
  'Comment devenir prestataire ?',
  'Comment contacter le service client ?',
  "C'est quoi LASSİ ?",
];
