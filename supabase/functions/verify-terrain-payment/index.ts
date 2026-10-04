import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { getWaveCheckout } from '../_shared/waveProxy.ts';
import { triggerTerrainPayout } from '../_shared/terrainPayout.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WAVE_API_KEY              = Deno.env.get('WAVE_API_KEY')              ?? '';
const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Authentification JWT obligatoire ──────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Non autorisé' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Non autorisé' }, 401);

    const { reference, reservationId, method } = await req.json();

    if (!reference || !reservationId || !method) {
      return json({ error: 'Paramètres manquants' }, 400);
    }

    // ── Vérifier que la réservation appartient à l'utilisateur ────────────────
    const { data: reservation, error: resErr } = await supabase
      .from('reservations_terrain')
      .select('user_id, statut, prestataire_id, montant_prestataire, moyen_paiement, date_reservation, heure_fin')
      .eq('id', reservationId)
      .single();

    if (resErr || !reservation) return json({ error: 'Réservation introuvable' }, 404);
    if (reservation.user_id !== user.id) return json({ error: 'Non autorisé' }, 403);

    // ── Idempotence : déjà payée → retour immédiat ────────────────────────────
    if (reservation.statut === 'paye') return json({ paid: true });

    // ── Vérification auprès de l'opérateur via les mêmes API que webhook ─────
    let paid = false;

    if (method === 'wave') {
      if (!WAVE_API_KEY) return json({ error: 'Wave non configuré' }, 500);
      try {
        const res = await getWaveCheckout(reference);
        if (res.ok) {
          const session = await res.json() as Record<string, unknown>;
          const ps = String(session.payment_status ?? session.status ?? '');
          paid = ['succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCEEDED', 'PAID', 'paid'].includes(ps);
        }
      } catch (e) {
        console.error('[verify-terrain-payment] Wave check erreur:', e instanceof Error ? e.message : e);
      }
    } else if (method === 'orange_money' || method === 'om') {
      if (!isOmReady()) return json({ error: 'Orange Money non configuré' }, 500);
      try {
        const omToken = await getOmToken();
        const ref = encodeURIComponent(reference);
        const res = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode/${ref}`, {
          headers: { Authorization: `Bearer ${omToken}` },
        });
        if (res.ok) {
          const d = await res.json() as Record<string, unknown>;
          const st = String(d.status ?? d.statut ?? d.txStatus ?? '').toUpperCase();
          paid = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCESSFULL', 'SUCCESSFUL', 'PAYMENT_SUCCESS'].includes(st);
        }
      } catch (e) {
        console.error('[verify-terrain-payment] OM check erreur:', e instanceof Error ? e.message : e);
      }
    } else {
      return json({ error: 'Moyen de paiement invalide' }, 400);
    }

    if (!paid) return json({ paid: false });

    // ── Confirmer en DB (garde atomique sur statut = 'en_attente') ─────────────
    const receiptCode = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      b => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 34],
    ).join('');

    const receiptValidUntil = new Date(
      `${reservation.date_reservation}T${reservation.heure_fin}`,
    ).toISOString();

    const { error: updErr } = await supabase
      .from('reservations_terrain')
      .update({
        statut:              'paye',
        receipt_status:      'valide',
        receipt_code:        receiptCode,
        receipt_valid_until: receiptValidUntil,
        moyen_paiement:      method === 'wave' ? 'wave' : 'orange_money',
        paiement_ref:        reference,
        payout_statut:       'pending',
      })
      .eq('id', reservationId)
      .eq('statut', 'en_attente'); // garde atomique — évite double-payout

    if (updErr) throw updErr;

    // ── Reversement prestataire (identique au chemin webhook) ─────────────────
    await triggerTerrainPayout(supabase, {
      reservationId,
      prestataireId:             reservation.prestataire_id as string,
      montant:                   reservation.montant_prestataire as number,
      moyenPaiement:             (reservation.moyen_paiement ?? method) as string,
      WAVE_API_KEY,
      OM_RETAILER_MSISDN,
      OM_RETAILER_PIN_ENCRYPTED,
    });

    return json({ paid: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[verify-terrain-payment] erreur:', msg);
    return json({ error: msg }, 500);
  }
});
