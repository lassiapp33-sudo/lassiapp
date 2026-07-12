const WEB_FALLBACK = 'https://lassi.sn';

/**
 * Lien profond vers un ÉLÉMENT précis d'un bloc À la une.
 * Utilise le domaine web pour la compatibilité cross-plateforme
 * (fonctionne même sans l'app installée).
 */
export const lienElement = (blocId: string, elementId: string): string =>
  `${WEB_FALLBACK}/a-la-une/${blocId}?produit=${elementId}`;

/**
 * Lien général vers tous les "À la une" d'une catégorie.
 */
export const lienCategorie = (categorieId: string): string =>
  `${WEB_FALLBACK}/a-la-une/categorie/${categorieId}`;

/**
 * Génère le texte de partage complet du bloc (tous éléments + message LASSİ).
 * Non modifiable par le prestataire.
 */
export const genererTextePartage = (params: {
  titre: string;
  description?: string;
  elements: { id: string; nom: string; prix: number }[];
  blocId: string;
  categorieId: string;
  nomCategorie: string;
  expireAt: string;
}): string => {
  const { titre, description, elements, blocId, categorieId, nomCategorie, expireAt } = params;

  const hoursLeft = Math.max(
    1,
    Math.ceil((new Date(expireAt).getTime() - Date.now()) / 3_600_000),
  );

  let texte = `*${titre}*\n\n`;

  elements.forEach(el => {
    const lien = lienElement(blocId, el.id);
    texte += `• ${el.nom} : ${el.prix.toLocaleString('fr-FR')} F CFA\n  👉 ${lien}\n`;
  });

  if (description) texte += `\n${description}\n`;

  texte += `\n⏳ Offre valable encore ${hoursLeft}h\n`;
  texte += `\n🛒 Cliquez sur un produit pour commander directement, ou ouvrez LASSİ pour découvrir tous les « À la une » du jour de vos ${nomCategorie} préférés !\n`;
  texte += `👉 ${lienCategorie(categorieId)}`;

  return texte;
};
