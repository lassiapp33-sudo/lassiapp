import { supabase } from '../lib/supabase';

// Normalise vers le format local sénégalais (9 chiffres).
// Doit produire le même résultat que normaliserTelephone() dans admin-vip/index.ts,
// car l'email du compte gérant est construit à partir du format local.
// "+221781234567" | "221781234567" | "78 123 45 67" → "781234567"
function normaliserTelephone(tel: string): string {
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.startsWith('221') && digits.length === 12) return digits.slice(3);
  return digits;
}

// Reconstruit l'email @vip.lassi.app identique à celui créé par la Edge Function.
function emailVip(telephone: string): string {
  return `${normaliserTelephone(telephone)}@vip.lassi.app`;
}

export async function connexionVip(telephone: string, motDePasse: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailVip(telephone),
    password: motDePasse,
  });
  if (error) throw new Error('Numéro ou mot de passe incorrect.');
  return {
    session: data.session,
    doitChangerMdp: data.user?.user_metadata?.doit_changer_mdp === true,
  };
}

// Changement simplifié au premier login : un seul champ, pas d'ancien mot de passe requis.
// Supabase autorise updateUser() sur la session active sans re-saisir l'ancien mot de passe.
export async function changerMotDePasse(nouveau: string) {
  if (nouveau.length < 6) throw new Error('6 caractères minimum.');
  const { error } = await supabase.auth.updateUser({
    password: nouveau,
    data: { doit_changer_mdp: false },
  });
  if (error) throw new Error("Le mot de passe n'a pas été changé. Réessaie.");
}

export async function deconnexionVip() {
  await supabase.auth.signOut();
}
