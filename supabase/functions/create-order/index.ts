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
  variant?:  string; // ex: "M, Noir" pour habillement
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Authentification
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // Récupérer le nom du client depuis profiles
    const { data: profile } = await sb
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    const clientName = profile?.name ?? null;

    // 2. Paramètres — jamais de montant total côté client
    const { shopId, items, note, orderType } = await req.json() as {
      shopId:     string;
      items:      OrderItem[];
      note?:      string;
      orderType?: 'place' | 'emporter';
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

    // 4. Séparer items normaux (products) et plats du jour (daily_specials)
    const regularItems = items.filter(i => !i.productId.startsWith('daily_'));
    const dailyItems   = items.filter(i =>  i.productId.startsWith('daily_'));

    // 5a. Récupérer les vrais prix des produits normaux
    let total = 0;
    const orderItemRows: Record<string, unknown>[] = [];
    // Produits récupérés en base (scope EF entier pour décrémentation stock)
    let fetchedProducts: any[] = [];

    if (regularItems.length > 0) {
      const productIds = regularItems.map(i => i.productId);
      const { data: products, error: prodErr } = await sb
        .from('products')
        .select('id, name, price, stock, stock_quantity')
        .in('id', productIds)
        .eq('shop_id', shopId);

      if (prodErr) throw new Error(prodErr.message);
      if (!products || products.length !== productIds.length) {
        return fail('Certains produits sont introuvables.', 400);
      }

      fetchedProducts = products;

      const outOfStock = products.filter((p: any) => p.stock === 'out').map((p: any) => p.name);
      if (outOfStock.length > 0) {
        return fail(`Produits épuisés : ${outOfStock.join(', ')}`, 400);
      }

      const priceMap = Object.fromEntries(products.map((p: any) => [p.id, { price: p.price, name: p.name }]));
      for (const item of regularItems) {
        const info = priceMap[item.productId];
        if (!info) return fail('Produit invalide.', 400);
        if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
          return fail('Quantité invalide (1–99).', 400);
        }
        total += info.price * item.qty;
        orderItemRows.push({
          product_id:   item.productId,
          product_name: item.variant ? `${info.name} (${item.variant})` : info.name,
          qty:          item.qty,
          unit_price:   info.price,
        });
      }
    }

    // 5b. Récupérer les prix des plats du jour
    if (dailyItems.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyIds = dailyItems.map(i => i.productId.replace(/^daily_/, ''));

      const { data: specials, error: spErr } = await sb
        .from('daily_specials')
        .select('id, name, price, date, shop_id')
        .in('id', dailyIds);

      if (spErr) throw new Error(spErr.message);
      if (!specials || specials.length !== dailyIds.length) {
        return fail('Certains plats du jour sont introuvables.', 400);
      }

      const spMap = Object.fromEntries(specials.map((s: any) => [s.id, s]));
      for (const item of dailyItems) {
        const realId = item.productId.replace(/^daily_/, '');
        const sp = spMap[realId];
        if (!sp) return fail('Plat du jour invalide.', 400);
        if (sp.shop_id !== shopId) return fail('Plat du jour invalide.', 400);
        if (sp.date !== today) return fail(`Le plat "${sp.name}" n'est plus disponible aujourd'hui.`, 400);
        if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
          return fail('Quantité invalide (1–99).', 400);
        }
        total += sp.price * item.qty;
        orderItemRows.push({
          product_id:   null,
          product_name: sp.name,
          qty:          item.qty,
          unit_price:   sp.price,
        });
      }
    }

    // 6. Créer la commande — order_type doit être 'place' ou 'emporter' (contrainte DB)
    const safeOrderType = orderType === 'emporter' ? 'emporter' : 'place';
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        shop_id:     shopId,
        client_id:   user.id,
        client_name: clientName,
        total,
        status:      'pending',
        note:        note?.trim().slice(0, 300) ?? null,
        order_type:  safeOrderType,
      })
      .select('id')
      .single();

    if (orderErr) throw new Error(orderErr.message);

    // 7. Insérer les lignes de commande
    const insertRows = orderItemRows.map(row => ({ ...row, order_id: order.id }));
    const { error: itemsErr } = await sb.from('order_items').insert(insertRows);
    if (itemsErr) throw new Error(itemsErr.message);

    // 8. Notifier le marchand
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
