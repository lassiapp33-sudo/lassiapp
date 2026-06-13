// ============================================================
// _shared/boostPlansPricing.ts
// Miroir serveur de BOOST_PLANS (Lassi/src/screens/merchant/VisibilityScreen.tsx)
// — tarifs des offres "Booster recherche" et "Épingle dorée" (carte).
// Même tarif pour les deux offres. Calculé ici côté serveur pour ne jamais
// faire confiance à un prix envoyé par le client.
// ============================================================

export interface BoostPlan {
  id: string
  price: number
  durationDays: number
}

export const BOOST_PLANS: BoostPlan[] = [
  { id: '1m', price: 500,  durationDays: 30 },
  { id: '3m', price: 1000, durationDays: 90 },
  { id: '6m', price: 2500, durationDays: 180 },
]

export function findBoostPlan(planId: string): BoostPlan | undefined {
  return BOOST_PLANS.find(p => p.id === planId)
}
