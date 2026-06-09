// Taux de commission LASSİ (1 %). Un seul endroit à modifier pour tout le dashboard.
export const COMMISSION_RATE = 0.01

// Montant de commission sur un total donné (arrondi au FCFA supérieur)
export function calcCommission(total: number): number {
  return Math.ceil(total * COMMISSION_RATE)
}

// Label lisible pour l'affichage (ex : "1 %")
export const COMMISSION_RATE_LABEL = `${(COMMISSION_RATE * 100).toLocaleString('fr-FR')} %`
