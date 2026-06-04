import { supabase } from '../lib/supabase';
import { IncomingOrder, OrderStatus } from '../types/orders';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Row types (Supabase response) ───────────────────────────────────────────

interface OrderItemRow {
  qty: number;
  product_name: string;
  unit_price: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLabel(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  const d = new Date(iso);
  return `à ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function shortId(uuid: string): string {
  return '#' + uuid.slice(0, 4).toUpperCase();
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function rowToOrder(row: Record<string, any>): IncomingOrder {
  const items = ((row.order_items as OrderItemRow[]) ?? []).map(i => ({
    qty: i.qty,
    name: i.product_name,
    price: i.unit_price * i.qty,
  }));
  return {
    id: row.id,
    orderId: shortId(row.id),
    initial: (row.client_name ?? 'C').charAt(0).toUpperCase(),
    clientName: row.client_name ?? 'Client',
    status: row.status as OrderStatus,
    items,
    total: row.total,
    payMethod: row.pay_method as 'wave' | 'om',
    timeLabel: timeLabel(row.created_at),
    prepTime: row.prep_time ?? undefined,
    orderType: (row.order_type === 'emporter' ? 'emporter' : 'place') as 'place' | 'emporter',
    refusalReason: row.refusal_reason ?? null,
  };
}

// ─── Requêtes ────────────────────────────────────────────────────────────────

export async function getShopOrders(shopId: string): Promise<IncomingOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrder);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus | 'refused',
  prepTime?: string,
): Promise<void> {
  const updates: Partial<{ status: string; prep_time: string }> = { status };
  if (prepTime) updates.prep_time = prepTime;
  const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function refuseOrder(orderId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'refused',
      refusal_reason: reason ?? null,
      refused_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}

export interface CreateOrderParams {
  shopId: string;
  clientName: string;
  clientPhone?: string;
  items: { productName: string; qty: number; unitPrice: number }[];
  total: number;
  payMethod: 'wave' | 'om' | 'cash';
  orderType: 'place' | 'emporter';
}

// ─── Commande sécurisée via Edge Function (total recalculé côté serveur) ──────

export interface SecureOrderItem {
  productId: string;
  qty: number;
}

export async function createOrderSecure(
  shopId: string,
  items: SecureOrderItem[],
  note?: string,
  orderType?: 'place' | 'emporter',
  idempotencyKey?: string,
): Promise<{ orderId: string; total: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi.');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      shopId,
      items,
      note,
      orderType: orderType ?? 'place',
      idempotencyKey,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'La commande a échoué.');
  return { orderId: body.orderId, total: body.total };
}

// ─── Revenus ─────────────────────────────────────────────────────────────────

export interface RevenueOrder {
  total: number;
  createdAt: string;
  status: string; // 'new' | 'preparing' | 'ready' | 'done'
}

/** Retourne toutes les commandes non-refusées des 6 derniers mois pour le calcul des revenus. */
export async function getShopRevenueOrders(shopId: string): Promise<RevenueOrder[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 6);
  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at, status')
    .eq('shop_id', shopId)
    .neq('status', 'refused')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    total: row.total,
    createdAt: row.created_at,
    status: row.status,
  }));
}

// ─── Commande directe (legacy — sans Edge Function) ───────────────────────────

export async function createOrder(params: CreateOrderParams): Promise<string> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      shop_id: params.shopId,
      client_name: params.clientName,
      client_phone: params.clientPhone ?? null,
      total: params.total,
      pay_method: params.payMethod,
      order_type: params.orderType,
    })
    .select()
    .single();
  if (orderError) throw new Error(orderError.message);

  const itemRows = params.items.map(i => ({
    order_id: order.id,
    product_name: i.productName,
    qty: i.qty,
    unit_price: i.unitPrice,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
  if (itemsError) throw new Error(itemsError.message);

  return order.id;
}
