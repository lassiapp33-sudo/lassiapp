import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Vérifier que l'appelant est ADMIN
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token!);
    if (authError || !user) return err('Non autorisé', 401);

    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return err('Réservé à l\'administrateur', 403);

    // 2. Params
    const { nomComplet, telephone, motDePasse } = await req.json();
    if (!nomComplet || !telephone || !motDePasse) return err('Champs manquants', 400);
    if (motDePasse.length < 8) return err('Mot de passe trop court (8 caractères min)', 400);

    // 3. Normaliser le téléphone → email interne (Supabase Auth a besoin d'un email)
    const tel = String(telephone).replace(/\D/g, '');
    const emailInterne = `livreur.${tel}@lassi.internal`;

    // 4. Créer l'utilisateur
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: emailInterne,
      password: motDePasse,
      email_confirm: true,
      user_metadata: { nom_complet: nomComplet, telephone: tel, role: 'livreur' },
    });
    if (createError) return err(createError.message, 400);

    const newId = created.user!.id;

    // 5. Profil + rôle livreur
    await admin.from('profiles').upsert({ id: newId, role: 'livreur' });

    // 6. Fiche livreur
    const { error: livreurError } = await admin.from('livreurs').insert({
      id: newId,
      nom_complet: nomComplet,
      telephone: tel,
      cree_par: user.id,
      actif: true,
    });
    if (livreurError) return err(livreurError.message, 400);

    return new Response(JSON.stringify({
      success: true,
      livreurId: newId,
      identifiant: tel,  // le livreur se connecte avec son numéro
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return err(e.message ?? 'Erreur serveur', 500);
  }
});

function err(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
