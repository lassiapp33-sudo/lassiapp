import { supabase }      from '../lib/supabase';
import { ClientOrder, ClientOrderStatus, CommerceType } from '../types/clientOrders';

interface OrderItemRow { product_name?: string; name?: string; qty?: number; unit_price?: number }
interface AvisRow      { id: string }
interface ShopRow      { name?: string; category?: string }

// ─── Mappage statuts DB → affichage client ───────────────────────────────────
// Statuts DB existants : 'new' | 'preparing' | 'ready' | 'done' | 'refused'

const STATUS_MAP: Record<string, ClientOrderStatus> = {
  new:       'pending',
  preparing: 'in_progress',
  ready:     'ready',
  done:      'completed',
  refused:   'cancelled',
};

function mapCategory(cat?: string): CommerceType {
  if (!cat) return 'other';
  const c = cat.toLowerCase();
  if (['food','resto','tangana','boulangerie','bakery','fruiterie'].some(k => c.includes(k))) return 'food';
  if (['hair','beauty','coiff','beaute'].some(k => c.includes(k)))       return 'beauty';
  if (['service','sport'].some(k => c.includes(k)))                      return 'service';
  return 'other';
}

function rowToOrder(row: Record<string, any>): ClientOrder {
  const shop     = (row.shops as ShopRow | null) ?? {};
  const items    = (row.order_items as OrderItemRow[] ?? []).map(i => ({
    name:  i.product_name ?? i.name ?? '—',
    qty:   i.qty   ?? 1,
    price: i.unit_price ?? 0,
  }));

  const avisRows = (row.avis as AvisRow[]) ?? [];
  const avisId   = avisRows.length > 0 ? avisRows[0].id : undefined;

  return {
    id:                 row.id,
    shopId:             row.shop_id ?? '',
    commerceName:       shop.name ?? '—',
    commerceType:       mapCategory(shop.category),
    items,
    totalAmount:        Number(row.total ?? 0),
    paymentMethod:      row.pay_method === 'om' ? 'orange_money' : 'wave',
    status:             STATUS_MAP[row.status] ?? 'pending',
    notes:              row.note ?? undefined,
    createdAt:          row.created_at,
    avisId,
    receiptCode:        row.receipt_code        ?? undefined,
    receiptStatus:      row.receipt_status      ?? 'aucun',
    receiptValidUntil:  row.receipt_valid_until ?? undefined,
    validatedAt:        row.validated_at        ?? undefined,
  };
}

// ─── Requêtes ────────────────────────────────────────────────────────────────

export async function getClientOrders(clientId: string): Promise<ClientOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), shops(name, category), avis(id), receipt_code, receipt_status, receipt_valid_until, validated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrder);
}

// Annule la commande côté client (status 'new' → 'refused')
export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'refused' })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}
