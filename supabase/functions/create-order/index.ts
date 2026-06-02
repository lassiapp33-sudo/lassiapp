// Edge Function — crée une commande en recalculant le total côté serveur
// Le montant n'est JAMAIS accepté depuis l'app : on recalcule à partir des vrais prix en base.
// Déployer : supabase functions deploy create-order

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  productId: string;
  qty:       number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Authentification
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // 2. Paramètres — jamais de montant total côté client
    const { shopId, items, note } = await req.json() as {
      shopId: string;
      items:  OrderItem[];
      note?:  string;
    };

    if (!shopId || !Array.isArray(items) || items.length === 0) {
      return fail('Paramètres invalides', 400);
    }

    // 3. Rate limiting : max 10 commandes / 5 minutes par utilisateur
    const { data: rateOk } = await sb.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action:  'create_order',
      p_max:     10,
      p_window:  '5 minutes',
    });
    if (!rateOk) return fail('Trop de commandes. Attends quelques minutes.', 429);

    // 4. Récupérer les vrais prix depuis la base
    const productIds = items.map(i => i.productId);
    const { data: products, error: prodErr } = await sb
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds)
      .eq('shop_id', shopId);

    if (prodErr) throw new Error(prodErr.message);
    if (!products || products.length !== productIds.length) {
      return fail('Certains produits sont introuvables.', 400);
    }

    // 5. Vérifier le stock de chaque produit
    const outOfStock = products.filter(p => p.stock === 'out').map(p => p.name);
    if (outOfStock.length > 0) {
      return fail(`Produits épuisés : ${outOfStock.join(', ')}`, 400);
    }

    // 6. Recalculer le total côté serveur
    const priceMap = Object.fromEntries(products.map(p => [p.id, p.price]));
    let total = 0;
    for (const item of items) {
      const price = priceMap[item.productId];
      if (price === undefined) return fail('Produit invalide.', 400);
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return fail('Quantité invalide (1–99).', 400);
      }
      total += price * item.qty;
    }

    // 7. Créer la commande
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        shop_id:   shopId,
        client_id: user.id,
        total,
        status:    'pending',
        note:      note?.trim().slice(0, 300) ?? null,
      })
      .select('id')
      .single();

    if (orderErr) throw new Error(orderErr.message);

    // 8. Insérer les lignes de commande avec les vrais prix
    const orderItems = items.map(item => ({
      order_id:   order.id,
      product_id: item.productId,
      qty:        item.qty,
      unit_price: priceMap[item.productId],
    }));

    const { error: itemsErr } = await sb.from('order_items').insert(orderItems);
    if (itemsErr) throw new Error(itemsErr.message);

    // 9. Notifier le marchand (insérer une notif en base)
    const { data: shop } = await sb
      .from('shops')
      .select('merchant_id')
      .eq('id', shopId)
      .single();

    if (shop?.merchant_id) {
      await sb.from('notifications').insert({
        user_id: shop.merchant_id,
        type:    'new_order',
        title:   'Nouvelle commande',
        body:    `Commande de ${total.toLocaleString('fr-FR')} FCFA`,
        data:    JSON.stringify({ orderId: order.id }),
        read:    false,
      });
    }

    return ok({ orderId: order.id, total });

  } catch (e) {
    console.error('[create-order]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
