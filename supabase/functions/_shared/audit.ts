// ============================================================
// _shared/audit.ts
// Section 8 — Logs & Audit Trail (traçabilité totale)
//
// Wrapper pour écrire dans audit_log depuis les Edge Functions admin-* et
// webhook-payment, via la RPC SECURITY DEFINER log_audit_event (réservée à
// authenticated/service_role). N'échoue jamais : un échec de journalisation
// ne doit jamais faire échouer l'action métier qui l'a déclenchée.
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseLike = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: any }> };

export interface AuditEvent {
  action: string;
  targetTable?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  // Identité de l'admin déjà vérifiée par l'Edge Function appelante (JWT).
  // Ignorée par log_audit_event si l'appel n'est pas fait avec service_role.
  actorId?: string;
  actorRole?: string;
}

export async function logAuditEvent(client: SupabaseLike, event: AuditEvent): Promise<void> {
  const { error } = await client.rpc('log_audit_event', {
    p_action: event.action,
    p_target_table: event.targetTable ?? null,
    p_target_id: event.targetId ?? null,
    p_before: event.before ?? null,
    p_after: event.after ?? null,
    p_metadata: event.metadata ?? null,
    p_actor_id: event.actorId ?? null,
    p_actor_role: event.actorRole ?? null,
  });
  if (error) console.error('[audit] log_audit_event échoué:', error.message);
}
