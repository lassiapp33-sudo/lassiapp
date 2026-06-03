// Taux de commission LASSİ (0,5 %). Un seul endroit à modifier pour tout le dashboard.
export const COMMISSION_RATE = 0.005

// Montant de commission sur un total donné (arrondi à l'entier FCFA le plus proche)
export function calcCommission(total: number): number {
  return Math.round(total * COMMISSION_RATE)
}

// Label lisible pour l'affichage (ex : "0,5 %")
export const COMMISSION_RATE_LABEL = `${(COMMISSION_RATE * 100).toLocaleString('fr-FR')} %`
