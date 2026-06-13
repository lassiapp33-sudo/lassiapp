// ============================================================
// _shared/offreQuartierPricing.ts
// Pricing dynamique "Offre du quartier" — miroir de
// Lassi/src/utils/offreQuartierPricing.ts.
//
// Le tarif de base d'un forfait (visibility_plans.price) couvre 1 ou 2
// produits ; chaque produit supplémentaire ajoute un surcoût fixe.
// Calculé ici côté serveur pour ne jamais faire confiance à un prix
// envoyé par le client.
// ============================================================

export const PRICE_INCREMENT_PER_EXTRA_PRODUCT = 500
export const FREE_PRODUCTS_THRESHOLD = 2

export function calculateOffreQuartierPrice(basePrice: number, nbProduits: number): number {
  const extraProducts = Math.max(0, nbProduits - FREE_PRODUCTS_THRESHOLD)
  return basePrice + extraProducts * PRICE_INCREMENT_PER_EXTRA_PRODUCT
}
