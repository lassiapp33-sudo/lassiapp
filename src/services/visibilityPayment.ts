import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/format';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey: ANON_KEY,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PayMethod = 'wave' | 'orange_money';

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
  productName: string | null;
  productEmoji: string | null;
}

export type CreatePaymentResult =
  | { status: 'awaiting_keys'; message: string }
  | { status: 'pending_payment'; subscriptionId: string; paymentUrl: string; reference: string };

export type VerifyResult =
  | { paid: true; status: 'active'; expiresAt: string }
  | { paid: false; status: 'pending' | 'awaiting_keys' | string };

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

export async function getActiveSub(shopId: string): Promise<ActiveSub | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('visibility_subscriptions')
    .select(
      'id, plan_id, amount, status, started_at, expires_at, paid_at, pay_method, product_id, ' +
        'plan:plan_id(label), product:product_id(name, emoji, photo_url)',
    )
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .gt('expires_at', now)
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
    productName: row.product?.name ?? null,
    productEmoji: row.product?.emoji ?? null,
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
  productId: string;
}): Promise<CreatePaymentResult> {
  const res = await fetch(`${FUNCTIONS_BASE}/create-visibility-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement');
  return data as CreatePaymentResult;
}

// ─── Vérifier un paiement ─────────────────────────────────────────────────────

export async function verifyVisibilityPayment(subscriptionId: string): Promise<VerifyResult> {
  const res = await fetch(`${FUNCTIONS_BASE}/verify-visibility-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ subscriptionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erreur de vérification');
  return data as VerifyResult;
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
    price: 6000,
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
    price: 10000,
    durationMonths: 1,
    durationDays: 30,
    oldPrice: null,
    perLabel: 'par mois',
    popular: false,
  },
  {
    id: '3m',
    label: '3 mois',
    desc: 'Économise 6 000 F',
    price: 24000,
    durationMonths: 3,
    durationDays: 90,
    oldPrice: 30000,
    perLabel: '8 000 F/mois',
    popular: true,
  },
  {
    id: '6m',
    label: '6 mois',
    desc: 'Économise 18 000 F',
    price: 42000,
    durationMonths: 6,
    durationDays: 180,
    oldPrice: 60000,
    perLabel: '7 000 F/mois',
    popular: false,
  },
];
