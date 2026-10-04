// Confirmation paiement + reversement + notifications pour beauty_reservations.
// Appelée depuis webhook-payment (OM path beauty_r + Wave path).
// La beauté n'utilise pas payment_intents — tout passe par cette fonction.

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

export interface ConfirmBeautyOptions {
  receivedAmount: number | null;
  keys: {
    WAVE_API_KEY: string;
    OM_RETAILER_MSISDN: string;
    OM_RETAILER_PIN_ENCRYPTED: string;
  };
}

export interface ConfirmBeautyResult {
  ok: boolean;
  already_processed?: boolean;
  payout_ref?: string;
  payout_error?: string;
  error?: string;
}

function genReceiptCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export async function confirmBeautyReservation(
  supabase: Sb,
  reservationId: string,
  opts: ConfirmBeautyOptions,
): Promise<ConfirmBeautyResult> {
  // 1. Charger la réservation
  const { data: resa, error: resaErr } = await supabase
    .from('beauty_reservations')
    .select('*, beauty_services(nom)')
    .eq('id', reservationId)
    .maybeSingle();

  if (resaErr || !resa) {
    return { ok: false, error: `beauty_reservation introuvable: ${resaErr?.message ?? 'null'}` };
  }

  // 2. Idempotence — déjà confirmée
  if (resa.statut !== 'en_attente') {
    return { ok: true, already_processed: true };
  }

  // 3. Génération du QR receipt
  const receiptCode       = genReceiptCode();
  const receiptValidUntil = resa.date_reservation && resa.heure_fin
    ? new Date(`${resa.date_reservation}T${resa.heure_fin}`).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 4. Marquer payée (garde atomique sur statut = 'en_attente')
  const { error: updErr } = await supabase
    .from('beauty_reservations')
    .update({
      statut:              'paye',
      receipt_code:        receiptCode,
      receipt_status:      'valide',
      receipt_valid_until: receiptValidUntil,
    })
    .eq('id', reservationId)
    .eq('statut', 'en_attente');

  if (updErr) {
    return { ok: false, error: `update beauté échoué: ${updErr.message}` };
  }

  // 5. Numéro prestataire
  const { data: profil } = await supabase
    .from('profiles')
    .select('phone, name')
    .eq('id', resa.prestataire_id)
    .maybeSingle();

  const phone = (profil?.phone ?? '').trim().replace(/^\+221/, '');

  // 6. Reversement
  const montant: number  = resa.montant_prestataire;
  const moyen: string    = resa.moyen_paiement ?? 'orange_money';
  const isProduction     = !!(
    opts.keys.WAVE_API_KEY ||
    (opts.keys.OM_RETAILER_MSISDN && opts.keys.OM_RETAILER_PIN_ENCRYPTED)
  );

  let payoutRef   = '';
  let payoutError = '';

  if (!PHONE_RE.test(phone)) {
    payoutError = `numéro prestataire invalide (longueur=${phone.length})`;
  } else if (!isProduction) {
    payoutRef = `SIM-BEAUTY-${Date.now()}-${reservationId.slice(0, 8).toUpperCase()}`;
  } else {
    try {
      if (moyen === 'wave') {
        payoutRef = await sendWavePayout(reservationId, montant, phone);
      } else {
        payoutRef = await sendOmPayout(
          reservationId, montant, phone,
          opts.keys.OM_RETAILER_MSISDN,
          opts.keys.OM_RETAILER_PIN_ENCRYPTED,
        );
      }
    } catch (e) {
      payoutError = e instanceof Error ? e.message : String(e);
    }
  }

  // 7. Mise à jour payout_statut
  await supabase
    .from('beauty_reservations')
    .update({ payout_statut: payoutError ? 'erreur' : 'ok' })
    .eq('id', reservationId);

  // 8. Notif prestataire (uniquement si reversement réussi)
  if (!payoutError) {
    const serviceNom  = (resa.beauty_services as { nom: string } | null)?.nom ?? 'Service beauté';
    const montantStr  = `${montant} FCFA`;
    const moyenStr    = moyen === 'orange_money' ? 'Orange Money' : 'Wave';
    const clientLabel = (resa.client_name as string | null) ?? 'Un client';

    const prestTitle = 'Reversement reçu';
    const prestBody  = `${clientLabel} a réservé "${serviceNom}". ${montantStr} reversés sur votre ${moyenStr}. Les frais Wave/OM sont à votre charge.`;

    try {
      await sendPushToUser(supabase, resa.prestataire_id, {
        title:     prestTitle,
        body:      prestBody,
        data:      { type: 'beauty_reservation_paye', montant, reservation_id: reservationId },
        channelId: 'commandes-v2',
        priority:  'high',
      });
    } catch (e) {
      console.error('[beautyConfirm] push prestataire:', e instanceof Error ? e.message : e);
    }

    try {
      await supabase.from('notifications').insert({
        user_id: resa.prestataire_id,
        type:    'payment',
        title:   prestTitle,
        body:    prestBody,
        data:    { type: 'beauty_reservation_paye', montant, reservation_id: reservationId },
      });
    } catch (e) {
      console.error('[beautyConfirm] notif in-app prestataire:', e instanceof Error ? e.message : e);
    }
  } else {
    console.error('[beautyConfirm] payout erreur réservation', reservationId, payoutError);
  }

  // 9. Notif client (best-effort, toujours — paiement confirmé même si payout en erreur)
  const clientId = resa.client_id as string | null;
  if (clientId) {
    const serviceNom = (resa.beauty_services as { nom: string } | null)?.nom ?? 'Service beauté';
    const heureStr   = resa.heure_debut ? String(resa.heure_debut).slice(0, 5) : '';
    const clientBody = heureStr
      ? `Réservation "${serviceNom}" confirmée à ${heureStr}. Votre code : ${receiptCode}`
      : `Réservation "${serviceNom}" confirmée. Votre code : ${receiptCode}`;

    try {
      await sendPushToUser(supabase, clientId, {
        title:     'Paiement confirmé ✓',
        body:      clientBody,
        data:      { type: 'beauty_payment_confirme', reservation_id: reservationId, receipt_code: receiptCode },
        channelId: 'commandes-v2',
        priority:  'high',
      });

      await supabase.from('notifications').insert({
        user_id: clientId,
        type:    'payment',
        title:   'Paiement confirmé ✓',
        body:    clientBody,
        data:    { type: 'beauty_payment_confirme', reservation_id: reservationId, receipt_code: receiptCode },
      });
    } catch (e) {
      console.error('[beautyConfirm] notif client:', e instanceof Error ? e.message : e);
    }
  }

  return payoutError
    ? { ok: true, payout_error: payoutError }
    : { ok: true, payout_ref: payoutRef };
}

// ── Wave Payout ───────────────────────────────────────────────────────────────
// WAVE_API_KEY lu depuis Deno.env par waveProxy (pas besoin de le passer)

async function sendWavePayout(reservationId: string, montant: number, phone: string): Promise<string> {
  const body = JSON.stringify({
    currency:         'XOF',
    receive_amount:   String(montant),
    mobile:           `+221${phone}`,
    client_reference: `beauty_${reservationId}`,
  });

  const res  = await waveRequestPayout(body, `beauty_payout_${reservationId}`);
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
      reference:           `beauty_${reservationId}`,
      receiveNotification: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>;
    throw new Error(`OM payout error (${res.status}): ${err.detail ?? JSON.stringify(err)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  return (data.transactionId ?? data.requestId ?? `beauty_${reservationId}`) as string;
}
