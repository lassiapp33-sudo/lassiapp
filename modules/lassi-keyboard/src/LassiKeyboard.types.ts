// Types partagés du module LASSI Keyboard.

/** Une réponse rapide insérable au tap (message de vente pré-écrit). */
export interface QuickReply {
  id: string;
  label: string;   // libellé affiché sur la touche du clavier
  text: string;    // texte réellement inséré (peut contenir {lien})
}

/** Une puce d'action de la barre LASSI (haut du clavier). */
export interface KeyboardChip {
  id: string;
  emoji: string;
  label: string;
  /** Texte inséré au tap. {lien} est remplacé par l'URL de la vitrine. */
  insert: string;
}

/** Données marchand écrites dans le stockage partagé lu par le clavier. */
export interface MerchantKeyboardData {
  /** URL vitrine publique, ex: https://s.lassi.tech/ma-boutique */
  vitrineUrl: string;
  shopName: string;
  /** Puces de la barre supérieure (vitrine, catalogue, commander…). */
  chips: KeyboardChip[];
  /** Réponses rapides de vente éditables par le marchand. */
  quickReplies: QuickReply[];
  /** Fond du clavier : couleur hex (#RRGGBB) ou URI d'image locale, optionnel. */
  background?: { type: 'color'; value: string } | { type: 'image'; uri: string } | null;
}
