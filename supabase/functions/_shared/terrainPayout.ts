// Reversement prestataire + notification après paiement terrain confirmé.
// Appelée depuis webhook-payment (OM path terrain_r + Wave path).
// La notification prestataire n'est émise QU'après payout réussi.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { waveRequestPayout } from './waveProxy.ts';
import { getOmToken, OM_BASE_URL } from './omAuth.ts';
import { sendPushToUser } from './push.ts';

type Sb = ReturnType<typeof createClient>;

const PHONE_RE = /^7[05678][0-9]{7}$/;

const TERMINAL_WAVE_ERRORS = new Set([
  'country-mismatch', 'currency-mismatch', 'idempotency-mismatch',
  'insufficient-funds', 'invalid-aggregated-merchant-id', 'aggregated-merchant-required',
  'recipient-minor', 'recipient-account-blocked', 'recipient-account-inactive',
  'recipient-limit-exceeded', 'request-not-json', 'request-parsing-error',
  'request-validation-error',
]);

export interface TerrainPayoutParams {
  reservationId: string;
  prestataireId: string;
  montant: number;
  moyenPaiement: string;
  WAVE_API_KEY: string;
  OM_RETAILER_MSISDN: string;
  OM_RETAILER_PIN_ENCRYPTED: string;
}

export async function triggerTerrainPayout(
  supabase: Sb,
  params: TerrainPayoutParams,
): Promise<void> {
  const isProduction = !!(
    params.WAVE_API_KEY ||
    (params.OM_RETAILER_MSISDN && params.OM_RETAILER_PIN_ENCRYPTED)
  );

  // 1. Numéro prestataire
  const { data: profil } = await supabase
    .from('profiles')
    .select('phone, name')
    .eq('id', params.prestataireId)
    .maybeSingle();

  const phone = (profil?.phone ?? '').trim().replace(/^\+221/, '');

  let payoutRef   = '';
  let payoutError = '';

  if (!PHONE_RE.test(phone)) {
    payoutError = `numéro terrain prestataire invalide (longueur=${phone.length})`;
  } else if (!isProduction) {
    payoutRef = `SIM-TERRAIN-${Date.now()}-${params.reservationId.slice(0, 8).toUpperCase()}`;
  } else {
    try {
      if (params.moyenPaiement === 'wave') {
        payoutRef = await sendWavePayout(params.reservationId, params.montant, phone);
      } else {
        payoutRef = await sendOmPayout(
          params.reservationId, params.montant, phone,
          params.OM_RETAILER_MSISDN,
          params.OM_RETAILER_PIN_ENCRYPTED,
        );
      }
    } catch (e) {
      payoutError = e instanceof Error ? e.message : String(e);
    }
  }

  // 2. Mettre à jour payout_statut dans reservations_terrain
  await supabase
    .from('reservations_terrain')
    .update({ payout_statut: payoutError ? 'erreur' : 'ok' })
    .eq('id', params.reservationId);

  if (payoutError) {
    console.error('[terrainPayout] payout erreur réservation', params.reservationId, payoutError);
    return;
  }

  // 3. Notif prestataire uniquement après payout réussi
  try {
    const { data: resaRow } = await supabase
      .from('reservations_terrain')
      .select('terrain_id, date_reservation, heure_debut, heure_fin')
      .eq('id', params.reservationId)
      .maybeSingle();

    const { data: terrainRow } = await supabase
      .from('terrains')
      .select('nom')
      .eq('id', resaRow?.terrain_id ?? '')
      .maybeSingle();

    const terrainNom  = (terrainRow?.nom as string | undefined) ?? 'Terrain';
    const montantStr  = `${params.montant} FCFA`;
    const moyenStr    = params.moyenPaiement === 'orange_money' ? 'Orange Money' : 'Wave';
    const heureStr    = resaRow?.heure_debut ? String(resaRow.heure_debut).slice(0, 5) : '';
    const heureFinStr = resaRow?.heure_fin   ? String(resaRow.heure_fin).slice(0, 5)   : '';
    const creneauStr  = heureStr && heureFinStr ? ` · ${heureStr} → ${heureFinStr}` : '';

    const title = 'Reversement reçu';
    const body  = `Réservation ${terrainNom}${creneauStr}. ${montantStr} reversés sur votre ${moyenStr}. Les frais Wave/OM sont à votre charge.`;

    await sendPushToUser(supabase, params.prestataireId, {
      title,
      body,
      data:      { type: 'terrain_reservation_paye', montant: params.montant, reservation_id: params.reservationId },
      channelId: 'commandes-v2',
      priority:  'high',
    });

    await supabase.from('notifications').insert({
      user_id: params.prestataireId,
      type:    'payment',
      title,
      body,
      data:    { type: 'terrain_reservation_paye', montant: params.montant, reservation_id: params.reservationId },
    });
  } catch (e) {
    console.error('[terrainPayout] notif prestataire erreur:', e instanceof Error ? e.message : e);
  }
}

// ── Wave Payout ───────────────────────────────────────────────────────────────

async function sendWavePayout(reservationId: string, montant: number, phone: string): Promise<string> {
  const body = JSON.stringify({
    currency:         'XOF',
    receive_amount:   String(montant),
    mobile:           `+221${phone}`,
    client_reference: `terrain_${reservationId}`,
  });

  const res  = await waveRequestPayout(body, `terrain_payout_${reservationId}`);
  const data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const code       = (data.code ?? data.error ?? 'unknown') as string;
    const isTerminal = TERMINAL_WAVE_ERRORS.has(code);
    const err        = Object.assign(
      new Error(`Wave payout error ${code}: ${data.message ?? JSON.stringify(data)}`),
      { isTerminal },
    );
    throw err;
  }

  if (data.status === 'failed' || data.payout_error) {
    const pe   = data.payout_error as Record<string, unknown> | undefined;
    const code = (pe?.error_code ?? 'unknown') as string;
    throw new Error(`Wave payout failed: ${code} — ${pe?.error_message ?? ''}`);
  }

  return data.id as string;
}

// ── OM Cash In ────────────────────────────────────────────────────────────────

async function sendOmPayout(
  reservationId: string,
  montant: number,
  phone: string,
  retailerMsisdn: string,
  retailerPinEncrypted: string,
): Promise<string> {
  const omToken = await getOmToken();

  const res = await fetch(`${OM_BASE_URL}/api/eWallet/v1/cashins`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${omToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner: {
        idType:           'MSISDN',
        id:               retailerMsisdn,
        encryptedPinCode: retailerPinEncrypted,
      },
      customer: { idType: 'MSISDN', id: phone },
      amount:   { value: montant, unit: 'XOF' },
      reference:           `terrain_${reservationId}`,
      receiveNotification: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>;
    throw new Error(`OM payout error (${res.status}): ${err.detail ?? JSON.stringify(err)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  return (data.transactionId ?? data.requestId ?? `terrain_${reservationId}`) as string;
}
