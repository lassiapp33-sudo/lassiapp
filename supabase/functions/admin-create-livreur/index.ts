import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Vérifier que l'appelant est ADMIN
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return err('Token manquant', 401);

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return err(`Non autorisé: ${authError?.message ?? 'token invalide'}`, 401);

    const { data: profile, error: profileError } = await db
      .from('profiles').select('is_admin').eq('id', user.id).single();
    if (profileError) return err(`Erreur profil: ${profileError.message}`, 500);
    if (!profile?.is_admin) return err('Réservé à l\'administrateur', 403);

    // 2. Params
    const { nomComplet, telephone, motDePasse } = await req.json();
    if (!nomComplet || !telephone || !motDePasse) return err('Champs manquants', 400);
    if (String(motDePasse).length < 8) return err('Mot de passe trop court (8 caractères min)', 400);

    const tel = String(telephone).replace(/\D/g, '');
    if (tel.length < 6) return err('Numéro de téléphone invalide', 400);

    const emailInterne = `livreur.${tel}@lassi.internal`;

    // 3. Créer l'utilisateur Auth via HTTP direct (auth admin API)
    // Les clés name/phone/role dans user_metadata sont lues par le trigger
    // handle_new_auth_user() pour créer automatiquement la ligne profiles.
    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey':        SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        email:         emailInterne,
        password:      motDePasse,
        email_confirm: true,
        user_metadata: {
          name:       nomComplet,
          nom_complet: nomComplet,
          phone:      tel,
          telephone:  tel,
          role:       'livreur',
          real_email: emailInterne,
        },
      }),
    });

    const createJson = await createResp.json().catch(() => ({}));

    if (!createResp.ok) {
      const msg = createJson?.message || createJson?.error_description || createJson?.msg
        || `HTTP ${createResp.status}`;
      return err(`Création utilisateur échouée: ${msg}`, 400);
    }

    const newId: string = createJson.id;
    if (!newId) return err('Utilisateur créé mais ID manquant', 500);

    // 4. Mettre à jour le rôle dans profiles (le trigger a déjà créé la ligne)
    await db.from('profiles').update({ role: 'livreur' }).eq('id', newId);

    // 5. Fiche livreur
    const { error: livreurError } = await db.from('livreurs').insert({
      id:         newId,
      nom_complet: nomComplet,
      telephone:  tel,
      cree_par:   user.id,
      actif:      true,
    });

    if (livreurError) {
      // Rollback : supprimer l'utilisateur auth créé
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
      });
      const msg = livreurError.message || livreurError.code || JSON.stringify(livreurError);
      return err(`Fiche livreur échouée: ${msg}`, 400);
    }

    return new Response(JSON.stringify({
      success:    true,
      livreurId:  newId,
      identifiant: tel,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e) || 'Erreur serveur';
    console.error('admin-create-livreur catch:', msg);
    return err(msg, 500);
  }
});

function err(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
