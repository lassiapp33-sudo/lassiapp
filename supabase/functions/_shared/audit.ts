// Audit sécurité webhook — best-effort (ne jamais bloquer le flux principal).
// Écrit dans payment_logs avec event_type='webhook_received' + metadata.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Sb = ReturnType<typeof createClient>;

export interface AuditEvent {
  action: string;
  targetTable?: string;
  metadata?: unknown;
}

export async function logAuditEvent(sb: Sb, event: AuditEvent): Promise<void> {
  try {
    await sb.from('payment_logs').insert({
      event_type:       'webhook_received',
      status:           event.action,
      provider_response: null,
      metadata: JSON.stringify({ action: event.action, target: event.targetTable, ...((event.metadata as object) ?? {}) }),
    });
  } catch (e) {
    console.error('[audit] logAuditEvent échec (best-effort):', e instanceof Error ? e.message : e);
  }
}
