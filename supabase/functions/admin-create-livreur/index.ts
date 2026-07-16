// ============================================================
// EDGE FUNCTION : admin-create-livreur
// Crée un compte Supabase Auth + profil livreur.
// Réservé à l'admin (vérifie is_admin sur le profil appelant).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Vérifier que l'appelant est admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier is_admin
    const { data: profile } = await userClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé.' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { nomComplet, telephone, motDePasse } = await req.json() as {
      nomComplet: string;
      telephone:  string;
      motDePasse: string;
    };

    if (!nomComplet?.trim() || !telephone?.trim() || !motDePasse?.trim()) {
      return new Response(JSON.stringify({ error: 'Champs requis manquants.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Utiliser le client service_role pour créer le compte
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Générer email technique pour le livreur
    const cleanPhone = telephone.replace(/\s+/g, '').replace(/^\+?221/, '');
    const authEmail = `livreur_221${cleanPhone}@lassi.app`;

    // Créer le compte Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password: motDePasse,
      email_confirm: true,
      user_metadata: {
        name: nomComplet,
        phone: telephone,
        role: 'livreur',
      },
    });

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'Erreur création compte.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const newUserId = newUser.user.id;

    // Créer le profil
    await adminClient.from('profiles').upsert({
      id:         newUserId,
      name:       nomComplet,
      phone:      telephone,
      auth_email: authEmail,
      email:      null,
      role:       'livreur',
    }, { onConflict: 'id' });

    // Créer la ligne livreurs
    const { error: livreurError } = await adminClient.from('livreurs').insert({
      id:          newUserId,
      nom_complet: nomComplet,
      telephone:   telephone,
      actif:       true,
      cree_par:    user.id,
    });

    if (livreurError) {
      return new Response(
        JSON.stringify({ error: livreurError.message }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur.';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } },
    );
  }
});
