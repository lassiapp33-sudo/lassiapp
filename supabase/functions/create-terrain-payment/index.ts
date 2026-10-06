// Edge Function — crée une session de paiement pour une réservation terrain
// Contrat : { reservationId: string, moyenPaiement: 'wave' | 'orange_money' }
// Lit le montant depuis la DB (jamais côté client) pour éviter toute falsification.

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callWaveCheckout }                from '../_shared/waveProxy.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';

const WAVE_API_KEY       = Deno.env.get('WAVE_API_KEY')              ?? '';
const OM_MERCHANT_CODE   = Deno.env.get('OM_MERCHANT_CODE')          ?? '';
const OM_WEBHOOK_SECRET  = Deno.env.get('OM_WEBHOOK_SECRET')         ?? '';
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PAYMENT_MODE       = Deno.env.get('PAYMENT_MODE')              ?? 'simulation';
const LASSI_PAY_BASE     = 'https://lassi.tech/paiement';
const WEBHOOK_BASE       = `${SUPABASE_URL}/functions/v1`;

const isWaveReady = () => PAYMENT_MODE === 'production' && !!WAVE_API_KEY;
const isOmProd    = () => PAYMENT_MODE === 'production' && isOmReady();

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Authentification JWT ──────────────────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Non autorisé' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Non autorisé' }, 401);

    const { reservationId, moyenPaiement } = await req.json() as {
      reservationId: string;
      moyenPaiement: 'wave' | 'orange_money';
    };

    if (!reservationId || !moyenPaiement) {
      return json({ error: 'Paramètres manquants' }, 400);
    }

    // ── Charger la réservation + vérifier appartenance ────────────────────────
    const { data: resa, error: resErr } = await supabase
      .from('reservations_terrain')
      .select('client_id, statut, prix_total, terrain_id, prestataire_id')
      .eq('id', reservationId)
      .single();

    if (resErr || !resa) return json({ error: 'Réservation introuvable' }, 404);
    if (resa.client_id !== user.id) return json({ error: 'Non autorisé' }, 403);
    if (resa.statut !== 'en_attente') return json({ error: 'Réservation non en attente' }, 409);

    const montant = resa.prix_total as number;

    // ── Simulation (pas de clé API configurée) ────────────────────────────────
    if (moyenPaiement === 'wave' ? !isWaveReady() : !isOmProd()) {
      return json({
        reference:  reservationId,
        paymentUrl: null,
        simulation: true,
      });
    }

    // ── Production Wave ───────────────────────────────────────────────────────
    if (moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        amount:           montant,
        currency:         'XOF',
        client_reference: reservationId,
        success_url:      `${LASSI_PAY_BASE}/terrain-succes?rid=${reservationId}`,
        error_url:        `${LASSI_PAY_BASE}/terrain-echec?rid=${reservationId}`,
      });
      const res  = await callWaveCheckout(waveBody, `terrain_${reservationId}`);
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok || !data.wave_launch_url) {
        console.error('[create-terrain-payment] Wave erreur:', data);
        return json({ error: 'Wave : session de paiement échouée' }, 500);
      }
      // data.id = Wave checkout session ID — nécessaire pour la vérification
      const waveSessionId = (data.id ?? data.checkout_id ?? reservationId) as string;
      return json({
        reference:  waveSessionId,
        paymentUrl: data.wave_launch_url as string,
        simulation: false,
      });
    }

    // ── Production Orange Money ───────────────────────────────────────────────
    const omToken     = await getOmToken();
    const callbackUrl = `${WEBHOOK_BASE}/webhook-payment?source=terrain_om&rid=${encodeURIComponent(reservationId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
    const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${omToken}`,
        'Content-Type':   'application/json',
        'X-Callback-Url': callbackUrl,
      },
      body: JSON.stringify({
        code:            OM_MERCHANT_CODE,
        name:            'LASSI',
        amount:          { value: montant, unit: 'XOF' },
        validity:        900,
        metadata:        { reservation_id: reservationId },
        notificationUrl: callbackUrl,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[create-terrain-payment] OM erreur:', resp.status, errBody);
      return json({ error: `Orange Money : QR code échoué (${resp.status})` }, 500);
    }

    const d        = await resp.json() as Record<string, unknown>;
    const deepLink = (d.deepLinks as Record<string, string> | undefined)?.OM ?? d.deepLink as string ?? '';
    const qrCode   = (d.qrCode ?? null) as string | null;

    if (!deepLink && !qrCode) {
      return json({ error: 'Orange Money : deep link absent de la réponse' }, 500);
    }

    return json({
      reference:  reservationId,
      paymentUrl: deepLink || null,
      qrCode,
      simulation: false,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[create-terrain-payment] erreur:', msg);
    return json({ error: msg }, 500);
  }
});
