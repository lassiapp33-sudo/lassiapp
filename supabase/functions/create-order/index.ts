import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isPositiveInt, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Taux de commission LASSİ (1 %). Un seul endroit à modifier.
const COMMISSION_RATE = 0.01

// ─── Calcul réduction serveur ────────────────────────────────────────────────

interface PromoRow {
  id:         string;
  titre:      string;
  type:       string;
  valeur:     number;
  cible_type: string;
  cible_id:   string | null;
  montant_min: number;
}

interface OrderItemInput {
  productId: string;
  qty:       number;
}

interface ProductRow {
  id:       string;
  price:    number;
  name:     string;
  stock:    string;
  category: string;
}

function applyBestPromo(
  promos:     PromoRow[],
  products:   ProductRow[],
  items:      OrderItemInput[],
  subtotal:   number,
): { discountAmount: number; promoLabel: string | null } {
  let best: { discountAmount: number; promoLabel: string } | null = null;

  for (const promo of promos) {
    if (promo.montant_min > 0 && subtotal < promo.montant_min) continue;

    let reduction   = 0;
    let label       = '';
    const val       = Number(promo.valeur);

    switch (promo.type) {
      case 'pourcentage': {
        let base = 0;
        if (promo.cible_type === 'vitrine') {
          base  = subtotal;
          label = `${promo.titre} −${val}%`;
        } else if (promo.cible_type === 'produit' && promo.cible_id) {
          const targets = items.filter(i => i.productId === promo.cible_id);
          const prod    = products.find(p => p.id === promo.cible_id);
          base  = targets.reduce((s, i) => s + (prod?.price ?? 0) * i.qty, 0);
          label = `${promo.titre} −${val}%`;
        } else if (promo.cible_type === 'categorie' && promo.cible_id) {
          const catProds = products.filter(p => p.category === promo.cible_id).map(p => p.id);
          const targets  = items.filter(i => catProds.includes(i.productId));
          base  = targets.reduce((s, i) => {
            const p = products.find(x => x.id === i.productId);
            return s + (p?.price ?? 0) * i.qty;
          }, 0);
          label = `${promo.titre} −${val}%`;
        }
        reduction = Math.ceil(base * val / 100);
        break;
      }

      case 'montant_fixe': {
        if (promo.cible_type === 'vitrine') {
          reduction = Math.min(val, subtotal - 1);
          label     = `${promo.titre} −${val} F`;
        }
        break;
      }

      case 'quantite_offerte': {
        // valeur = X (buy X get 1 free)
        if (promo.cible_type === 'produit' && promo.cible_id) {
          const targets  = items.filter(i => i.productId === promo.cible_id);
          const prod     = products.find(p => p.id === promo.cible_id);
          const totalQty = targets.reduce((s, i) => s + i.qty, 0);
          const freeQty  = Math.floor(totalQty / (val + 1));
          if (freeQty > 0 && prod) {
            reduction = prod.price * freeQty;
            label     = `${promo.titre} ${val}+1 offert`;
          }
        }
        break;
      }

      case 'prix_barre': {
        // valeur = nouveau prix du produit
        if (promo.cible_type === 'produit' && promo.cible_id) {
          const targets = items.filter(i => i.productId === promo.cible_id);
          const prod    = products.find(p => p.id === promo.cible_id);
          if (prod) {
            const orig  = targets.reduce((s, i) => s + prod.price * i.qty, 0);
            const promo_ = targets.reduce((s, i) => s + val * i.qty, 0);
            reduction   = orig - promo_;
            label       = `${promo.titre} prix promo`;
          }
        }
        break;
      }
    }

    // Garder la réduction la plus avantageuse pour le client
    if (reduction > 0 && (!best || reduction > best.discountAmount)) {
      best = { discountAmount: reduction, promoLabel: label };
    }
  }

  return best
    ? { discountAmount: best.discountAmount, promoLabel: best.promoLabel }
    : { discountAmount: 0, promoLabel: null };
}

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Section 5 : rate limiting anti-spam (20 commandes / heure / utilisateur) ──
    const { data: rl } = await admin.rpc('check_rate_limit', {
      p_key: `order:${user.id}`,
      p_max_attempts: 20,
      p_window_seconds: 3600,
      p_block_seconds: 0,
    })
    if (rl?.allowed === false) {
      return new Response(JSON.stringify({ error: 'Trop de commandes créées. Réessaie dans quelques instants.' }), {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rl.retry_after ?? 3600) },
      })
    }

    const { shopId, items, note, orderType, idempotencyKey } = await req.json()
    if (!shopId || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'shopId et items requis' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Section 4 : validation stricte des entrées ────────────────────────────
    if (!isUUID(shopId)) {
      return new Response(JSON.stringify({ error: 'shopId invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const MAX_ITEMS = 50
    const MAX_QTY   = 999
    if (items.length > MAX_ITEMS) {
      return new Response(JSON.stringify({ error: 'Trop d\'articles dans la commande' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    for (const item of items as unknown[]) {
      const productId = (item as Record<string, unknown> | null)?.productId
      const qty       = (item as Record<string, unknown> | null)?.qty
      if (!isUUID(productId) || !isPositiveInt(qty, MAX_QTY)) {
        return new Response(JSON.stringify({ error: 'Article de commande invalide' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
    }

    if (note !== undefined && note !== null && !isSafeString(note, { maxLen: 500 })) {
      return new Response(JSON.stringify({ error: 'Note trop longue (500 caractères max)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (
      idempotencyKey !== undefined && idempotencyKey !== null &&
      !isSafeString(idempotencyKey, { maxLen: 200, pattern: /^[A-Za-z0-9_:.-]+$/ })
    ) {
      return new Response(JSON.stringify({ error: 'idempotencyKey invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const ALLOWED_ORDER_TYPES = ['place', 'emporter']
    if (orderType !== undefined && orderType !== null && !ALLOWED_ORDER_TYPES.includes(orderType)) {
      return new Response(JSON.stringify({ error: 'Type de commande invalide.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ① Idempotence : si une commande avec cette clé existe déjà → retourner la même
    if (idempotencyKey) {
      const { data: existing } = await admin
        .from('orders')
        .select('id, total, discount_amount, promo_label')
        .eq('idempotency_key', idempotencyKey)
        .eq('client_id', user.id)
        .maybeSingle()

      if (existing) {
        const commission = Math.ceil(existing.total * COMMISSION_RATE)
        return new Response(JSON.stringify({
          orderId:        existing.id,
          total:          existing.total,
          subtotal:       existing.total + (existing.discount_amount ?? 0),
          discountAmount: existing.discount_amount ?? 0,
          promoLabel:     existing.promo_label,
          commission,
        }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // ② Recharger les produits depuis la DB (prix officiels)
    const productIds = items.map((i: any) => i.productId)
    const { data: products, error: prodError } = await admin
      .from('products')
      .select('id, price, name, stock, category')
      .in('id', productIds)
      .eq('shop_id', shopId)

    if (prodError || !products?.length) throw new Error('Produits introuvables')

    const productMap: Record<string, ProductRow> =
      Object.fromEntries(products.map((p: any) => [p.id, p]))

    // ③ Calculer le sous-total aux prix réels (ignorer tout montant client)
    let subtotal = 0
    const orderItems = items.map((item: any) => {
      const product = productMap[item.productId]
      if (!product) throw new Error(`Produit ${item.productId} introuvable`)
      if (product.stock === 'out') throw new Error(`"${product.name}" est en rupture de stock`)
      subtotal += product.price * item.qty
      return { product_name: product.name, qty: item.qty, unit_price: product.price }
    })

    // ④ Recharger les promos actives et valides côté serveur
    const now = new Date().toISOString()
    const { data: promos } = await admin
      .from('promotions')
      .select('id, titre, type, valeur, cible_type, cible_id, montant_min')
      .eq('shop_id', shopId)
      .eq('actif', true)
      .or(`date_debut.is.null,date_debut.lte.${now}`)
      .or(`date_fin.is.null,date_fin.gte.${now}`)

    // ⑤ Appliquer la meilleure réduction (jamais confiance au client)
    const { discountAmount, promoLabel } = applyBestPromo(
      promos ?? [],
      products as ProductRow[],
      items as OrderItemInput[],
      subtotal,
    )

    const total = Math.max(subtotal - discountAmount, 1) // jamais ≤ 0

    // ⑥ Commission LASSİ 1% calculée sur le montant APRÈS réduction
    const commission = Math.ceil(total * COMMISSION_RATE)

    // ⑦ Créer la commande + articles en une seule transaction atomique (RPC)
    const { data: profile } = await admin
      .from('profiles').select('name').eq('id', user.id).maybeSingle()

    const { data: orderResult, error: orderError } = await admin
      .rpc('create_order_atomic', {
        p_shop_id:         shopId,
        p_client_id:       user.id,
        p_client_name:     profile?.name ?? 'Client',
        p_total:           total,
        p_discount_amount: discountAmount,
        p_promo_label:     promoLabel ?? null,
        p_order_type:      orderType ?? 'place',
        p_note:            note ?? null,
        p_idempotency_key: idempotencyKey ?? null,
        p_items:           orderItems,
      })

    if (orderError) {
      // Double-tap concurrent : UNIQUE (client_id, idempotency_key) violé →
      // la transaction a été rollbackée, récupérer la commande existante et la retourner.
      if (orderError.code === '23505' && idempotencyKey) {
        const { data: dup } = await admin
          .from('orders')
          .select('id, total, discount_amount, promo_label')
          .eq('idempotency_key', idempotencyKey)
          .eq('client_id', user.id)
          .maybeSingle()
        if (dup) {
          const commission = Math.ceil(dup.total * COMMISSION_RATE)
          return new Response(JSON.stringify({
            orderId:        dup.id,
            total:          dup.total,
            subtotal:       dup.total + (dup.discount_amount ?? 0),
            discountAmount: dup.discount_amount ?? 0,
            promoLabel:     dup.promo_label,
            commission,
          }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
        }
      }
      throw orderError
    }

    const orderId = (orderResult as any).id as string

    // ⑧ Push au prestataire — best-effort, ne bloque pas la réponse au client
    try {
      const { data: shop } = await admin
        .from('shops')
        .select('merchant_id')
        .eq('id', shopId)
        .single()

      if (shop?.merchant_id) {
        const { data: tokenRows } = await admin
          .from('push_tokens')
          .select('token')
          .eq('user_id', shop.merchant_id)

        const tokens: string[] = (tokenRows ?? []).map((r: any) => r.token)
        const clientName = profile?.name ?? 'Un client'
        const totalFr    = `${Number(total).toLocaleString('fr-FR')} FCFA`
        const notifBody  = `${clientName} vient de passer une commande de ${totalFr}.`

        if (tokens.length > 0) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(tokens.map(to => ({
              to,
              title:     'Nouvelle commande 🛎️',
              body:      notifBody,
              data:      { type: 'commande', orderId },
              sound:     'default',
              channelId: 'commandes',
            }))),
          })
        }

        // Notification in-app (écran cloche)
        await admin.from('notifications').insert({
          user_id: shop.merchant_id,
          type:    'order',
          title:   'Nouvelle commande 🛎️',
          body:    notifBody,
          data:    { order_id: orderId },
        })
      }
    } catch {
      // best-effort : la commande est déjà créée, on ignore l'erreur de notif
    }

    return new Response(JSON.stringify({
      orderId,
      total,
      subtotal,
      discountAmount,
      promoLabel,
      commission,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    // Log serveur complet pour debug — jamais exposé au client
    console.error('[create-order]', err?.code ?? '', err?.message ?? err)
    // Les erreurs métier (rupture de stock, produit introuvable…) sont jetées
    // via new Error('...') sans .code. Les erreurs Postgres ont toujours un .code.
    const isBusinessError = !err?.code
    const clientMsg = isBusinessError
      ? (err?.message ?? 'Une erreur est survenue.')
      : 'Une erreur est survenue. Réessaie dans quelques instants.'
    return new Response(JSON.stringify({ error: clientMsg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
