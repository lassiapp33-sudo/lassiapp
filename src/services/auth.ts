/**
 * services/auth.ts — Couche d'abstraction entre les écrans et Supabase.
 *
 * Stratégie d'identifiant :
 *   - Le téléphone est l'identifiant MÉTIER (affiché à l'utilisateur).
 *   - Supabase exige un email pour son auth email+password.
 *   - Si l'utilisateur fournit un vrai email → on l'utilise pour l'auth Supabase
 *     (permet la récupération de mot de passe par email).
 *   - Sinon → on génère un email technique interne (221XXXXXXXX@lassi.app)
 *     uniquement compris par Supabase, jamais montré à l'utilisateur.
 *   - Pour se connecter avec son téléphone, on fait une RPC Supabase
 *     (get_auth_email_by_phone) pour retrouver quel email a été utilisé.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, SUPABASE_URL, SUPABASE_ANON, getCachedToken, setCachedToken, safeGetSession } from '../lib/supabase';
import { SESSION_ACTIVE_KEY } from '../lib/secureStorage';
import { AuthUser, UserRole } from '../store/authStore';
import { getInitials } from '../utils/getInitials';
import { uploadImage, logoPath } from './storage';
import { saveConsent } from './consents';
import type { WeekHours } from './hours';
import logger from '../utils/logger';
import { isNetworkError } from '../utils/network';

export { SESSION_ACTIVE_KEY };

// ─── Helpers ────────────────────────────────────────────────────────────────

// Génère un email technique Supabase à partir d'un numéro sénégalais.
// Nettoie les espaces et le préfixe +221/221.
function phoneToTechEmail(phone: string): string {
  const digits = phone.replace(/\s+/g, '').replace(/^\+?221/, '');
  return `221${digits}@lassi.app`;
}

// Traduit les messages d'erreur Supabase en français clair.
function traduireErreur(message: string): string {
  if (
    message.includes('User already registered') ||
    message.includes('already been registered') ||
    message.includes('already registered')
  )
    return 'Ce numéro est déjà associé à un compte. Connecte-toi.';
  if (message.includes('Invalid login credentials')) return 'Numéro ou mot de passe incorrect.';
  if (message.includes('Email not confirmed')) return 'Compte non confirmé. Vérifie tes emails.';
  if (message.includes('Password should be at least'))
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (message.includes('Unable to validate email address')) return 'Adresse email invalide.';
  if (isNetworkError(message)) return 'Pas de connexion Internet. Vérifie ton réseau.';
  return 'Une erreur est survenue. Réessaie.';
}

// Construit un AuthUser depuis un enregistrement profiles Supabase.
function profileToAuthUser(row: Record<string, any>): AuthUser {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? '',
    role: row.role as UserRole,
    initial: getInitials(row.name),
    avatarUrl: row.avatar_url ?? undefined,
  };
}

// ─── Inscription ────────────────────────────────────────────────────────────

export interface RegisterParams {
  name: string;
  phone: string;
  email: string; // email réel — peut être '' si non fourni
  password: string;
  role: UserRole;
}

export async function register(params: RegisterParams): Promise<AuthUser> {
  const realEmail = params.email.trim();

  // Anti-spam : limite les inscriptions par appareil/IP (Section 5)
  const { error: rlError } = await supabase.rpc('check_signup_rate_limit');
  if (rlError?.code === 'PT429') {
    throw new Error(rlError.message);
  }

  // L'email Supabase : réel si fourni (utile pour reset mdp), sinon technique
  const authEmail = realEmail || phoneToTechEmail(params.phone);

  // 1 — Créer le compte dans Supabase Auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: authEmail,
    password: params.password,
    options: {
      // raw_user_meta_data : récupéré par le trigger SQL pour créer le profil
      data: {
        name: params.name,
        phone: params.phone,
        role: params.role,
        real_email: realEmail, // email réel optionnel ('' si absent)
      },
    },
  });

  if (signUpError) throw new Error(traduireErreur(signUpError.message));
  if (!signUpData.user) throw new Error('Inscription impossible. Réessaie.');

  // 2 — Insérer / compléter le profil dans la table profiles
  //     (le trigger SQL crée aussi la ligne ; l'upsert garantit les données complètes)
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: signUpData.user.id,
      name: params.name,
      phone: params.phone,
      auth_email: authEmail,
      email: realEmail || null,
      role: params.role,
    },
    { onConflict: 'id' },
  );

  // Erreur non bloquante : le trigger a déjà créé la ligne de base
  if (profileError) {
    logger.warn('[auth] Upsert profil échoué (trigger couvre):', profileError.message);
  }

  // Enregistre la preuve de consentement CGU (non bloquant)
  saveConsent(signUpData.user.id, params.role === 'merchant' ? 'prestataire' : 'client').catch(e =>
    logger.warn('[auth] saveConsent échoué (non bloquant):', e),
  );

  return {
    id: signUpData.user.id,
    name: params.name,
    phone: params.phone,
    email: realEmail,
    role: params.role,
    initial: getInitials(params.name),
  };
}

// ─── Inscription marchand (compte + boutique en une passe) ──────────────────

export interface RegisterMerchantParams {
  // Données utilisateur
  name: string;
  phone: string;
  email: string;
  password: string;
  // Données boutique
  shopName: string;
  shopSubtitle?: string; // tagline auto-généré depuis les sous-catégories
  shopCategory: string;
  shopSubcategories?: string[];
  shopType?: 'products' | 'services' | 'memberships' | 'terrains';
  shopAddress?: string;
  openingHours?: WeekHours | null;
  logoLocalUri?: string | null;
  // Position GPS capturée à la finalisation du compte → devient le "domicile fixe" du commerce
  latitude?: number | null;
  longitude?: number | null;
  zone?: string;
}

export async function registerMerchant(params: RegisterMerchantParams): Promise<AuthUser> {
  // 1. Créer le compte auth + ligne profiles
  const user = await register({
    name: params.name,
    phone: params.phone,
    email: params.email,
    password: params.password,
    role: 'merchant',
  });

  // 2. Créer la ligne shops liée au nouveau marchand
  const { data: shopRow, error: shopError } = await supabase
    .from('shops')
    .insert({
      merchant_id: user.id,
      name: params.shopName,
      subtitle: params.shopSubtitle ?? '',
      description: null,
      category: params.shopCategory,
      subcategories: params.shopSubcategories ?? [],
      shop_type: params.shopType ?? 'products',
      address_text: params.shopAddress ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      zone: params.zone ?? '',
      is_open: true,
      opening_hours: params.openingHours ?? null,
    })
    .select('id')
    .single();

  if (shopError) {
    // Nettoyage définitif : supprimer le compte auth+profil pour libérer
    // le numéro et permettre une nouvelle tentative sans "déjà associé".
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON,
          },
        });
      }
      await supabase.auth.signOut();
    } catch {
      /* ignore — signOut seul si delete-account échoue */
    }
    throw new Error(`Impossible de créer ta vitrine : ${shopError.message}`);
  }

  // 3. Upload du logo si l'utilisateur en a fourni un (non bloquant)
  if (params.logoLocalUri && shopRow?.id) {
    try {
      const path = logoPath(shopRow.id);
      const logoUrl = await uploadImage('logos', params.logoLocalUri, path);
      await supabase.from('shops').update({ logo_url: logoUrl }).eq('id', shopRow.id);
    } catch (e) {
      logger.warn('[auth] Upload logo échoué (non bloquant):', e);
    }
  }

  return user;
}

// ─── Connexion ──────────────────────────────────────────────────────────────

export interface LoginParams {
  phone: string;
  password: string;
}

export async function login(params: LoginParams): Promise<AuthUser> {
  const cleanPhone = params.phone.replace(/\s+/g, '');

  // 1 — Retrouver l'email auth via fetch direct (anon, contourne GoTrue au démarrage)
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_auth_email_by_phone`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_phone: cleanPhone }),
  });

  if (!rpcRes.ok) {
    const errBody: { code?: string; message?: string } = await rpcRes.json().catch(() => ({}));
    if (errBody.code === 'PT429' || errBody.code === 'PT403') {
      throw new Error(errBody.message ?? 'Trop de tentatives.');
    }
    throw new Error('Numéro introuvable. Vérifie ton numéro ou crée un compte.');
  }

  const authEmail: string | null = await rpcRes.json();
  if (!authEmail) {
    throw new Error('Numéro introuvable. Vérifie ton numéro ou crée un compte.');
  }

  // 2 — Connexion via REST direct — bypass total du mutex GoTrue (bug Android)
  type GoTrueSession = { access_token: string; refresh_token: string; user: { id: string } };
  const tokenFetch = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify({ email: authEmail, password: params.password }),
  });
  const tokenTimeout = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('Connexion trop lente. Vérifie ta connexion et réessaie.')), 20_000),
  );
  const tokenRes = await Promise.race([tokenFetch, tokenTimeout]);

  if (!tokenRes.ok) {
    const errBody = (await tokenRes.json().catch(() => ({}))) as { error_description?: string; message?: string };
    const msg = errBody.error_description ?? errBody.message ?? '';
    // Enregistrer l'échec (best-effort)
    fetch(`${SUPABASE_URL}/rest/v1/rpc/record_login_failure`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_phone: cleanPhone }),
    }).catch(() => {});
    if (msg.toLowerCase().includes('invalid login credentials') || tokenRes.status === 400) {
      throw new Error('Mot de passe incorrect.');
    }
    throw new Error(traduireErreur(msg) || 'Connexion impossible. Réessaie.');
  }

  const session = (await tokenRes.json()) as GoTrueSession;
  const { access_token, refresh_token } = session;
  const userId = session.user?.id;
  if (!userId || !access_token) throw new Error('Connexion impossible. Réessaie.');

  // Token disponible immédiatement pour toutes les requêtes suivantes
  setCachedToken(access_token);

  // 3 — Récupérer le profil complet (raw fetch avec le token frais)
  const profile = await getProfileById(userId, access_token);
  if (!profile) throw new Error('Profil introuvable. Contacte le support LASSİ.');

  // Injecter la session dans GoTrue en arrière-plan (pour le refresh automatique)
  supabase.auth.setSession({ access_token, refresh_token }).catch(() => {});

  // Réinitialiser le compteur d'échecs (best-effort)
  fetch(`${SUPABASE_URL}/rest/v1/rpc/record_login_success`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_phone: cleanPhone }),
  }).catch(() => {});

  // Trace la connexion réussie (best-effort)
  fetch(`${SUPABASE_URL}/rest/v1/rpc/log_audit_event`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_action: 'login_success' }),
  }).catch(() => {});

  AsyncStorage.setItem(SESSION_ACTIVE_KEY, '1').catch(e => logger.warn('[auth] session flag write failed', e));
  return profile;
}

// ─── Connexion livreur (email interne @lassi.internal) ──────────────────────

export async function loginLivreur(telephone: string, password: string): Promise<AuthUser> {
  const tel = telephone.replace(/\D/g, '');
  const emailInterne = `livreur.${tel}@lassi.internal`;

  type GoTrueSession = { access_token: string; refresh_token: string; user: { id: string } };
  const tokenRes = await Promise.race([
    fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email: emailInterne, password }),
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Connexion trop lente. Réessaie.')), 20_000),
    ),
  ]);

  if (!tokenRes.ok) throw new Error('Identifiants incorrects.');
  const session = (await tokenRes.json()) as GoTrueSession;
  const { access_token, refresh_token } = session;
  if (!access_token || !session.user?.id) throw new Error('Identifiants incorrects.');

  setCachedToken(access_token);
  supabase.auth.setSession({ access_token, refresh_token }).catch(() => {});

  const profile = await getProfileById(session.user.id, access_token);
  if (!profile) throw new Error('Profil introuvable. Contacte le support LASSİ.');

  AsyncStorage.setItem(SESSION_ACTIVE_KEY, '1').catch(e => logger.warn('[auth] session flag write failed', e));
  return profile;
}

// ─── Déconnexion ────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const token = getCachedToken();

  // Trace la déconnexion (best-effort, non bloquant)
  if (token) {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_audit_event`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: 'logout' }),
    }).catch(() => {});
  }

  // Révoque le token côté serveur (best-effort, non bloquant)
  if (token) {
    fetch(`${SUPABASE_URL}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  // Nettoyer immédiatement sans attendre le réseau
  setCachedToken(null);
  AsyncStorage.removeItem(SESSION_ACTIVE_KEY).catch(() => {});
  // Nettoyer SecureStore (session locale) en arrière-plan
  supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

// ─── Mot de passe oublié ────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  // Fonctionne uniquement pour les comptes créés avec un email réel.
  // Pour les comptes sans email (email technique), orienter vers le support.
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'https://lassiapp33-sudo.github.io/lassiapp/reset-password.html',
  });
  if (error) throw new Error(traduireErreur(error.message));
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(traduireErreur(error.message));
}

export function onPasswordRecovery(callback: () => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') callback();
  });
  return () => subscription.unsubscribe();
}

// ─── Récupération de session au démarrage ───────────────────────────────────

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const { data: { session }, error } = await safeGetSession(15_000);

    if (error) {
      if (!isNetworkError(error.message)) {
        supabase.auth.signOut().catch(() => {});
      }
      return null;
    }

    if (!session?.user) return null;

    // token frais disponible : mise à jour du cache immédiate
    if (session.access_token) setCachedToken(session.access_token);

    const profile = await getProfileById(session.user.id, session.access_token);
    if (profile) return profile;

    // Fallback minimal depuis les métadonnées JWT (réseau indisponible)
    const meta = session.user.user_metadata ?? {};
    const role = meta.role as UserRole | undefined;
    const name = meta.name as string | undefined;
    const phone = meta.phone as string | undefined;
    if (role && name && phone) {
      return {
        id: session.user.id,
        name,
        phone,
        email: session.user.email ?? '',
        role,
        initial: getInitials(name),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Écoute des changements d'état d'auth ───────────────────────────────────

// Retourne une fonction de désinscription (cleanup dans useEffect).
export function onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    // INITIAL_SESSION doit être ignoré EN PREMIER — sur web un nouveau listener
    // reçoit immédiatement INITIAL_SESSION (parfois avec session null) ce qui
    // déclencherait callback(null) et déconnecterait l'utilisateur.
    if (event === 'INITIAL_SESSION') return;
    // TOKEN_REFRESHED_FAILED ou SIGNED_OUT : session terminée
    if (!session?.user) {
      callback(null);
      return;
    }
    const profile = await getProfileById(session.user.id).catch(() => null);
    // Ne pas déconnecter si le profil est introuvable lors d'un TOKEN_REFRESHED :
    // la session est valide, c'est probablement une erreur réseau transitoire.
    // On appelle callback(null) uniquement si la session elle-même est invalide.
    if (!profile) return;
    callback(profile);
  });
  return () => subscription.unsubscribe();
}

// ─── Helpers internes ───────────────────────────────────────────────────────

async function getProfileById(userId: string, token?: string): Promise<AuthUser | null> {
  const authToken = token ?? getCachedToken() ?? SUPABASE_ANON;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,name,phone,email,role,avatar_url&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${authToken}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>[];
  if (!data?.length) return null;
  return profileToAuthUser(data[0]);
}

// ─── Mise à jour avatar ──────────────────────────────────────────────────────

export async function updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
