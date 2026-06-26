import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─── Envoi via l'API Expo Push ────────────────────────────────────────────────

interface ExpoPushMessage {
  to:        string;
  title:     string;
  body:      string;
  data:      Record<string, unknown>;
  sound:     string;
  channelId?: string;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(messages),
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Authentification de l'appelant
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

    const { conversationId, preview } = await req.json()
    if (!conversationId || !preview) {
      return new Response(JSON.stringify({ error: 'conversationId et preview requis' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (!isUUID(conversationId)) {
      return new Response(JSON.stringify({ error: 'conversationId invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (!isSafeString(preview, { maxLen: 1000 })) {
      return new Response(JSON.stringify({ error: 'preview invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ① Récupérer la conversation + boutique en une passe
    const { data: conv } = await admin
      .from('conversations')
      .select('client_id, shop_id, shops(merchant_id)')
      .eq('id', conversationId)
      .single()
    if (!conv) throw new Error('Conversation introuvable')

    const merchantId = (conv.shops as any)?.merchant_id ?? null
    if (!merchantId) throw new Error('Boutique introuvable')

    // ② Profil de l'expéditeur
    const { data: senderProfile } = await admin
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single()

    // ③ Vérifier que l'appelant est bien participant de cette conversation.
    //    Sans ce contrôle, tout utilisateur authentifié connaissant un conversationId
    //    pourrait envoyer des push notifications arbitraires à n'importe qui.
    let recipientId: string
    if (senderProfile?.role === 'merchant') {
      if (merchantId !== user.id) {
        return new Response(JSON.stringify({ error: 'Non autorisé — vous n\'êtes pas le prestataire de cette conversation' }), {
          status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      recipientId = conv.client_id
    } else {
      if (conv.client_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Non autorisé — vous n\'êtes pas le client de cette conversation' }), {
          status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      recipientId = merchantId
    }

    // Pas de notification à soi-même
    if (recipientId === user.id) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const senderName = senderProfile?.name ?? 'Nouveau message'
    const body       = preview.length > 80 ? preview.substring(0, 80) + '…' : preview

    // ④ Tokens push du destinataire
    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId)

    const tokens: string[] = (tokenRows ?? []).map((r: any) => r.token)

    if (tokens.length > 0) {
      await sendExpoPush(tokens.map(to => ({
        to,
        title:     senderName,
        body,
        data:      { type: 'message', conversationId },
        sound:     'default',
        channelId: 'messages',
      })))
    }

    // ⑤ Insérer la notification en base (pour l'écran notifications in-app)
    await admin.from('notifications').insert({
      user_id: recipientId,
      type:    'message',
      title:   senderName,
      body,
      data:    { conversation_id: conversationId },
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
