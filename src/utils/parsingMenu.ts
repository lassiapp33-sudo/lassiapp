export interface ProduitExtrait {
  id: string;           // temporaire, pour l'édition avant sauvegarde
  nom: string;
  prix: number | null;  // null si le prix n'a pas pu être détecté
  ligneOriginale: string; // pour debug / relecture
  confiance: 'haute' | 'moyenne' | 'basse';
}

/**
 * Détecte un prix dans une ligne de texte.
 * Gère : "1500", "1500 F", "1500 FCFA", "1 500", "1.500", "1500F"
 */
const REGEX_PRIX = /(\d[\d\s.,]{1,7})\s*(?:f\s*cfa|fcfa|f\b|francs?)?/gi;

const nettoyerPrix = (raw: string): number | null => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const val = parseInt(digits, 10);
  // Filtre les valeurs absurdes (ex : numéro de téléphone capté par erreur)
  if (val < 50 || val > 200_000) return null;
  return val;
};

/**
 * Extrait les produits (nom + prix) depuis le texte brut OCR.
 */
export const extraireProduits = (texteBrut: string): ProduitExtrait[] => {
  const lignes = texteBrut
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const produits: ProduitExtrait[] = [];

  lignes.forEach((ligne, index) => {
    const matches = [...ligne.matchAll(REGEX_PRIX)];
    if (matches.length === 0) return; // pas de prix sur cette ligne → ignorée

    // Prend le DERNIER nombre de la ligne (le prix est généralement en fin de ligne)
    const dernierMatch = matches[matches.length - 1];
    const prix = nettoyerPrix(dernierMatch[1]);
    if (!prix) return;

    // Le nom du plat = tout ce qui précède le prix sur la ligne
    let nom = ligne.slice(0, dernierMatch.index).trim();
    // Nettoyage : retirer les tirets/points de séparation typographique (".....", "---")
    nom = nom.replace(/[.\-_]{2,}/g, '').trim();
    // Retirer une puce éventuelle en début de ligne
    nom = nom.replace(/^[-•*]\s*/, '').trim();

    if (nom.length < 2) return; // ligne inexploitable (juste un prix isolé)

    // Niveau de confiance basique
    let confiance: 'haute' | 'moyenne' | 'basse' = 'moyenne';
    if (nom.length >= 4 && nom.length <= 40 && /[a-zA-ZÀ-ÿ]/.test(nom)) {
      confiance = 'haute';
    }
    if (nom.length < 3 || nom.length > 50) {
      confiance = 'basse';
    }

    produits.push({
      id: `tmp-${index}-${Date.now()}`,
      nom: capitaliser(nom),
      prix,
      ligneOriginale: ligne,
      confiance,
    });
  });

  return produits;
};

// Capitalise chaque premier caractère de mot (title case)
const capitaliser = (texte: string): string => {
  if (!texte) return texte;
  return texte.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};
