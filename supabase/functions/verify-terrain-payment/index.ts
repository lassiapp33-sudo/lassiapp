import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
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
    const { reference, reservationId, method } = await req.json();

    if (!reference || !reservationId || !method) {
      return json({ error: 'Paramètres manquants' }, 400);
    }

    // ── Vérification auprès de l'opérateur ────────────────────────────────────
    // MODE DEV : si les clés ne sont pas configurées, on simule un paiement réussi
    const waveKey = Deno.env.get('WAVE_SECRET_KEY');
    const omKey   = Deno.env.get('OM_API_KEY');
    const devMode = !waveKey && !omKey;

    let paid = false;

    if (devMode) {
      paid = true; // simulation — à retirer quand les vraies clés sont en place
    } else if (method === 'wave') {
      if (!waveKey) return json({ error: 'WAVE_SECRET_KEY non configurée' }, 500);
      const res = await fetch(`https://api.wave.com/v1/checkout/sessions/${reference}`, {
        headers: { Authorization: `Bearer ${waveKey}` },
      });
      if (!res.ok) throw new Error(`Wave ${res.status}`);
      const session = await res.json();
      paid = session.payment_status === 'succeeded';
    } else {
      if (!omKey) return json({ error: 'OM_API_KEY non configurée' }, 500);
      const res = await fetch(
        `https://api.orange.com/orange-money-webpay/dev/v1/transactionstatus/${reference}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${omKey}`, 'Content-Type': 'application/json' },
        },
      );
      if (!res.ok) throw new Error(`OM ${res.status}`);
      const tx = await res.json();
      paid = tx.status === 'SUCCESSFULL';
    }

    if (!paid) return json({ paid: false });

    // ── Mise à jour de la réservation ─────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Récupérer date + heure_fin pour calculer la validité du QR
    const { data: res, error: fetchErr } = await supabase
      .from('reservations_terrain')
      .select('date_reservation, heure_fin')
      .eq('id', reservationId)
      .single();

    if (fetchErr || !res) throw new Error('Réservation introuvable');

    const receiptValidUntil = new Date(
      `${res.date_reservation}T${res.heure_fin}`,
    ).toISOString();

    // Générer un code QR alphanumérique 8 chars
    const receipt_code = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      b => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 34],
    ).join('');

    const { error: updErr } = await supabase
      .from('reservations_terrain')
      .update({
        statut: 'paye',
        receipt_status: 'valide',
        receipt_code,
        receipt_valid_until: receiptValidUntil,
        moyen_paiement: method === 'wave' ? 'wave' : 'orange_money',
        paiement_ref: reference,
      })
      .eq('id', reservationId);

    if (updErr) throw updErr;

    return json({ paid: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    return json({ error: msg }, 500);
  }
});
