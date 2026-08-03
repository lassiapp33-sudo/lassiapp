const WEB_FALLBACK = 'https://lassi.sn';

// https://lassi.sn/b/x7k9mq/2  (code bloc + index élément)
export const lienElement = (blocCode: string, elementIndex: number): string =>
  `${WEB_FALLBACK}/b/${blocCode}/${elementIndex}`;

// https://lassi.sn/b/x7k9mq  (code bloc seul)
export const lienBloc = (blocCode: string): string =>
  `${WEB_FALLBACK}/b/${blocCode}`;

// https://lassi.sn/a-la-une/categorie/cat-id  (inchangé)
export const lienCategorie = (categorieId: string): string =>
  `${WEB_FALLBACK}/a-la-une/categorie/${categorieId}`;

export const genererTextePartage = (params: {
  titre: string;
  description?: string;
  elements: { nom: string; prix: number }[];
  blocCode: string;
  categorieId: string;
  nomCategorie: string;
  expireAt: string;
}): string => {
  const { titre, description, elements, blocCode, categorieId, nomCategorie, expireAt } = params;

  const hoursLeft = Math.max(
    1,
    Math.ceil((new Date(expireAt).getTime() - Date.now()) / 3_600_000),
  );

  let texte = `*${titre}*\n\n`;

  elements.forEach((el, index) => {
    const lien = lienElement(blocCode, index);
    texte += `• ${el.nom} : ${el.prix.toLocaleString('fr-FR')} F CFA\n  👉 ${lien}\n`;
  });

  if (description) texte += `\n${description}\n`;

  texte += `\n⏳ Offre valable encore ${hoursLeft}h\n`;
  texte += `\n🛒 Cliquez sur un produit pour commander directement, ou ouvrez LASSİ pour découvrir tous les « À la une » du jour de vos ${nomCategorie} préférés.\n`;
  texte += `👉 ${lienCategorie(categorieId)}`;

  return texte;
};
