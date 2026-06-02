import { supabase }                           from '../lib/supabase';
import { VERSION as CGU_VERSION }            from '../legal/cgu';
import { VERSION as PRIVACY_VERSION }        from '../legal/confidentialite';

export { CGU_VERSION, PRIVACY_VERSION };

export async function saveConsent(
  userId: string,
  role:   'client' | 'prestataire',
): Promise<void> {
  const { error } = await supabase.from('user_consents').insert({
    user_id:         userId,
    cgu_version:     CGU_VERSION,
    privacy_version: PRIVACY_VERSION,
    user_role:       role,
  });
  if (error) throw error;
}

/** Vérifie si l'utilisateur a accepté les versions actuelles des documents. */
export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('cgu_version', CGU_VERSION)
    .eq('privacy_version', PRIVACY_VERSION)
    .limit(1)
    .single();
  return Boolean(data);
}
