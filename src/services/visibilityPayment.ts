import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/format';
import { calculateOffreQuartierPrice } from '../utils/offreQuartierPricing';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: ANON_KEY,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PayMethod = 'wave' | 'orange_money' | 'credit';

/** Méthodes affichées par le sélecteur Wave/OM de PayFooter (hors crédit LASSI, géré par PayFooterCredit). */
export type WaveOrangeMethod = 'wave' | 'orange_money';

// Interface locale pour la ligne Supabase (visibility_subscriptions avec join plan + produit)
interface VisibilitySubRow {
  id: string;
  plan_id: string;
  amount: number;
  status: string;
  started_at: string;
  expires_at: string;
  paid_at: string | null;
  pay_method: string;
  product_id: string | null;
  product_ids: string[] | null;
  all_products: boolean;
  plan: { label: string } | null;
  product: { name: string; emoji: string | null; photo_url: string | null } | null;
}

export interface VisibilityPlan {
  id: string;
  label: string;
  desc: string; // ex: "Économise 6 000 F" — calculé côté client
  price: number;
  durationMonths: number;
  durationDays: number;
  oldPrice: number | null;
  perLabel: string;
  popular: boolean;
}

export interface ActiveSub {
  id: string;
  planId: string;
  planLabel: string;
  amount: number;
  status: 'active';
  startedAt: string;
  expiresAt: string;
  paidAt: string | null;
  payMethod: PayMethod;
  productId: string | null;
  /** IDs des produits sélectionnés (null si allProducts). */
  productIds: string[] | null;
  productName: string | null;
  productEmoji: string | null;
  /** Nombre de produits mis en avant (0 si allProducts). */
  productCount: number;
  /** Toute la vitrine est mise en avant (plutôt que des produits précis). */
  allProducts: boolean;
}

export type CreatePaymentResult =
  | { status: 'awaiting_keys'; message: string }
  | {
      status:         'pending_payment';
      subscriptionId: string;
      paymentUrl:     string;  // Wave: URL checkout / OM: deepLink ouvrant l'app OM
      qrCode:         string;  // OM: image QR base64 (fallback si deepLink indisponible) / vide pour Wave
      reference:      string;
    };

export type VerifyResult =
  | { paid: true; status: 'active'; expiresAt: string }
  | { paid: false; status: 'pending' | 'awaiting_keys' | 'failed' | string };

// ─── Charger les plans depuis la DB (avec fallback statique) ─────────────────

export async function getVisibilityPlans(): Promise<VisibilityPlan[]> {
  const { data, error } = await supabase
    .from('visibility_plans')
    .select('id, label, price, duration_months, duration_days, old_price, per_label, popular')
    .eq('active', true)
    .order('duration_months');

  if (error || !data?.length) {
    // Fallback statique si la table n'est pas encore migrée
    return FALLBACK_PLANS;
  }

  return data.map(r => ({
    id: r.id,
    label: r.label,
    desc: computePlanDesc(r.price, r.old_price ?? null, r.duration_days),
    price: r.price,
    durationMonths: r.duration_months,
    durationDays: r.duration_days,
    oldPrice: r.old_price ?? null,
    perLabel: r.per_label,
    popular: r.popular,
  }));
}

// ─── Charger l'abonnement actif du shop courant ───────────────────────────────

export async function getActiveSub(
  shopId: string,
  offerType?: 'quartier' | 'recherche' | 'carte',
): Promise<ActiveSub | null> {
  const now = new Date().toISOString();
  let query = supabase
    .from('visibility_subscriptions')
    .select(
      'id, plan_id, amount, status, started_at, expires_at, paid_at, pay_method, ' +
        'product_id, product_ids, all_products, ' +
        'plan:plan_id(label), product:product_id(name, emoji, photo_url)',
    )
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .gt('expires_at', now);

  if (offerType) {
    query = query.eq('offer_type', offerType);
  }

  const { data } = await query
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as VisibilitySubRow;
  return {
    id: row.id,
    planId: row.plan_id,
    planLabel: row.plan?.label ?? row.plan_id,
    amount: row.amount,
    status: 'active',
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    payMethod: row.pay_method as PayMethod,
    productId: row.product_id,
    productIds: row.product_ids,
    productName: row.all_products ? null : (row.product?.name ?? null),
    productEmoji: row.all_products ? null : (row.product?.emoji ?? null),
    productCount: row.product_ids?.length ?? (row.product_id ? 1 : 0),
    allProducts: row.all_products,
  };
}

// ─── Vérifier si les clés de paiement sont configurées côté serveur ──────────
// Appelé au chargement de l'écran pour choisir entre PayFooter / PayFooterUnavailable.
// Retourne { wave: false, orange_money: false } en cas d'erreur → mode indisponible.

export async function checkPaymentAvailability(): Promise<{
  wave: boolean;
  orange_money: boolean;
}> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/create-visibility-payment`, {
      method: 'GET',
      headers: await authHeaders(),
    });
    if (!res.ok) return { wave: false, orange_money: false };
    return (await res.json()) as { wave: boolean; orange_money: boolean };
  } catch {
    return { wave: false, orange_money: false };
  }
}

// ─── Initier un paiement ──────────────────────────────────────────────────────

export async function createVisibilityPayment(params: {
  planId: string;
  payMethod: PayMethod;
  offerType: 'quartier' | 'recherche' | 'carte';
  /** Produits choisis (ignoré si offerType !== 'quartier'). */
  productIds: string[];
  /** Mettre en avant toute la vitrine plutôt que des produits précis (quartier uniquement). */
  allProducts: boolean;
}): Promise<CreatePaymentResult> {
  const res = await fetch(`${FUNCTIONS_BASE}/create-visibility-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let errMsg = 'Erreur de paiement';
    try { const e = await res.json(); errMsg = e.error ?? errMsg; } catch {}
    throw new Error(errMsg);
  }
  const data = await res.json();
  return data as CreatePaymentResult;
}

// ─── Acheter un forfait avec le crédit LASSI ──────────────────────────────────
// Active immédiatement le forfait (pas d'attente de webhook) en débitant
// shops.credit_balance. Utilisable pour les 3 offres (quartier/recherche/carte).

export interface CreditPurchaseResult {
  status: 'active';
  offerType: 'quartier' | 'recherche' | 'carte';
  expiresAt: string;
  amountSpent: number;
  newBalance: number;
}

export async function createCreditPurchase(params: {
  offerType: 'quartier' | 'recherche' | 'carte';
  planId: string;
  /** Produits choisis (offre "quartier" uniquement, ignoré si allProducts === true). */
  productIds?: string[];
  /** Mettre en avant toute la vitrine plutôt que des produits précis (offre "quartier"). */
  allProducts?: boolean;
}): Promise<CreditPurchaseResult> {
  const res = await fetch(`${FUNCTIONS_BASE}/create-credit-purchase`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let errMsg = 'Erreur de paiement';
    try { const e = await res.json(); errMsg = e.error ?? errMsg; } catch {}
    throw new Error(errMsg);
  }
  const data = await res.json();
  return data as CreditPurchaseResult;
}

// ─── Prix dynamique selon le nombre de produits mis en avant ─────────────────
// Le tarif de base d'un forfait (plan.price / plan.oldPrice) couvre 1 ou 2
// produits ; chaque produit supplémentaire ajoute un surcoût fixe (cf.
// offreQuartierPricing.ts). Le même surcoût est appliqué au prix barré pour
// préserver l'économie affichée ("Économise X F").

export function getPlanPriceFor(
  plan: VisibilityPlan,
  nbProduits: number,
): { price: number; oldPrice: number | null } {
  return {
    price: calculateOffreQuartierPrice(plan.price, nbProduits),
    oldPrice: plan.oldPrice != null ? calculateOffreQuartierPrice(plan.oldPrice, nbProduits) : null,
  };
}

// ─── Vérifier un paiement OM ─────────────────────────────────────────────────
// Orange Money active l'abonnement via webhook (verify-visibility-payment).
// L'app lit simplement l'état courant en DB — pas d'appel à une Edge Function.

export async function verifyVisibilityPayment(subscriptionId: string): Promise<VerifyResult> {
  const { data, error } = await supabase
    .from('visibility_subscriptions')
    .select('status, expires_at')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (error || !data) throw new Error('Abonnement introuvable');

  if (data.status === 'active') {
    return { paid: true, status: 'active', expiresAt: data.expires_at as string };
  }
  return { paid: false, status: data.status as string };
}

// ─── Modifier les produits sélectionnés d'un abonnement Offre du Quartier ────

export async function updateSubProducts(productIds: string[]): Promise<void> {
  const res = await fetch(`${FUNCTIONS_BASE}/update-visibility-products`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ productIds }),
  });
  if (!res.ok) {
    let errMsg = 'Erreur de mise à jour';
    try { const e = await res.json(); errMsg = e.error ?? errMsg; } catch {}
    throw new Error(errMsg);
  }
}

// ─── Statistiques de visibilité réelles ──────────────────────────────────────

export interface VisibilityStats {
  /** Visiteurs uniques de la boutique ce mois-ci (recently_viewed). */
  viewsThisMonth: number;
  /** Visiteurs uniques depuis le début de l'abonnement actif. */
  visitsSinceSub: number;
  /** Commandes reçues ce mois (discussions lancées). */
  ordersThisMonth: number;
  /** CA des commandes "done" ce mois (en FCFA). */
  revenueThisMonth: number;
}

export async function getVisibilityStats(shopId: string): Promise<VisibilityStats> {
  const { data, error } = await supabase.rpc('get_shop_visibility_stats', {
    p_shop_id: shopId,
  });
  if (error) throw new Error(error.message);
  const row = data as {
    views_this_month: number;
    visits_since_sub: number;
    orders_this_month: number;
    revenue_this_month: number;
  };
  return {
    viewsThisMonth: row.views_this_month ?? 0,
    visitsSinceSub: row.visits_since_sub ?? 0,
    ordersThisMonth: row.orders_this_month ?? 0,
    revenueThisMonth: row.revenue_this_month ?? 0,
  };
}

// ─── Description marketing calculée depuis les données de tarif ──────────────

function computePlanDesc(price: number, oldPrice: number | null, durationDays: number): string {
  if (oldPrice && oldPrice > price) {
    const savings = oldPrice - price;
    return `Économise ${formatPrice(savings)}`;
  }
  if (durationDays <= 14) return 'Idéal pour tester';
  return 'Paiement unique';
}

// ─── Plans de secours (si la table n'est pas encore migrée) ──────────────────

const FALLBACK_PLANS: VisibilityPlan[] = [
  {
    id: '2sem',
    label: '2 semaines',
    desc: 'Idéal pour tester',
    price: 1000,
    durationMonths: 0,
    durationDays: 14,
    oldPrice: null,
    perLabel: 'par 2 semaines',
    popular: false,
  },
  {
    id: '1m',
    label: '1 mois',
    desc: 'Paiement unique',
    price: 3000,
    durationMonths: 1,
    durationDays: 30,
    oldPrice: null,
    perLabel: 'par mois',
    popular: false,
  },
  {
    id: '3m',
    label: '3 mois',
    desc: 'Économise 4 000 F',
    price: 5000,
    durationMonths: 3,
    durationDays: 90,
    oldPrice: 9000,
    perLabel: '1 667 F/mois',
    popular: true,
  },
  {
    id: '6m',
    label: '6 mois',
    desc: 'Économise 9 000 F',
    price: 9000,
    durationMonths: 6,
    durationDays: 180,
    oldPrice: 18000,
    perLabel: '1 500 F/mois',
    popular: false,
  },
];
