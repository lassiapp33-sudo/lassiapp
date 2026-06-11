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

import { supabase } from '../lib/supabase';
import { AuthUser, UserRole } from '../store/authStore';
import { getInitials } from '../utils/getInitials';
import { uploadImage, logoPath } from './storage';
import { saveConsent } from './consents';
import type { WeekHours } from './hours';
import logger from '../utils/logger';
import { isNetworkError } from '../utils/network';

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
      is_open: false,
      opening_hours: params.openingHours ?? null,
    })
    .select('id')
    .single();

  if (shopError) {
    // Nettoyage : supprimer le compte auth pour éviter un état bloqué
    // (merchant avec profil mais sans boutique)
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
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

  // 1 — Retrouver l'email auth (réel ou technique) via la RPC Supabase
  //     La fonction SQL get_auth_email_by_phone est accessible aux utilisateurs anonymes
  const { data: authEmail, error: rpcError } = await supabase.rpc('get_auth_email_by_phone', {
    p_phone: cleanPhone,
  });

  if (rpcError) {
    // Section 5 : rate limiting anti-bruteforce (5 tentatives / 15 min, blocage 30 min)
    // Section 6 : compte temporairement suspendu (pattern attaquant détecté)
    if (rpcError.code === 'PT429' || rpcError.code === 'PT403') {
      throw new Error(rpcError.message);
    }
    throw new Error('Numéro introuvable. Vérifie ton numéro ou crée un compte.');
  }
  if (!authEmail) {
    throw new Error('Numéro introuvable. Vérifie ton numéro ou crée un compte.');
  }

  // 2 — Connexion Supabase avec l'email auth retrouvé
  const { data, error: loginError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: params.password,
  });

  if (loginError) throw new Error(traduireErreur(loginError.message));
  if (!data.user) throw new Error('Connexion impossible. Réessaie.');

  // 3 — Récupérer le profil complet
  const profile = await getProfileById(data.user.id);
  if (!profile) throw new Error('Profil introuvable. Contacte le support LASSİ.');

  // Section 8 : trace la connexion réussie (best-effort, non bloquant)
  void supabase.rpc('log_audit_event', { p_action: 'login_success' }).then(
    ({ error }) => {
      if (error) logger.warn('[auth] log_audit_event(login_success) échoué:', error.message);
    },
    () => {},
  );

  return profile;
}

// ─── Déconnexion ────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  // Section 8 : trace la déconnexion AVANT de révoquer la session — une fois
  // signOut() appelé, l'utilisateur n'est plus authentifié et la RPC ne
  // pourrait plus identifier qui se déconnecte.
  await supabase.rpc('log_audit_event', { p_action: 'logout' }).then(
    ({ error }) => {
      if (error) logger.warn('[auth] log_audit_event(logout) échoué:', error.message);
    },
    () => {},
  );

  // scope: 'global' (Section 7) — révoque le refresh token côté serveur
  // (toutes les sessions de cet utilisateur) en plus de nettoyer le
  // stockage local (secureStorage).
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw new Error(traduireErreur(error.message));
}

// ─── Mot de passe oublié ────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  // Fonctionne uniquement pour les comptes créés avec un email réel.
  // Pour les comptes sans email (email technique), orienter vers le support.
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'lassiapp://reset-password',
  });
  if (error) throw new Error(traduireErreur(error.message));
}

// ─── Récupération de session au démarrage ───────────────────────────────────

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // Token expiré ou révoqué : on nettoie la session stockée pour éviter
    // que Supabase rejoue le refresh à chaque démarrage et logue une erreur.
    if (error) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }

    if (!session?.user) return null;
    return getProfileById(session.user.id);
  } catch {
    // Sécurité : si getSession jette (rare), on retourne null proprement
    await supabase.auth.signOut().catch(() => {});
    return null;
  }
}

// ─── Écoute des changements d'état d'auth ───────────────────────────────────

// Retourne une fonction de désinscription (cleanup dans useEffect).
export function onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    // TOKEN_REFRESHED_FAILED ou SIGNED_OUT : session terminée
    if (!session?.user) {
      callback(null);
      return;
    }
    // Ignore INITIAL_SESSION — géré par getSessionUser au démarrage
    if (event === 'INITIAL_SESSION') return;
    const profile = await getProfileById(session.user.id).catch(() => null);
    callback(profile);
  });
  return () => subscription.unsubscribe();
}

// ─── Helpers internes ───────────────────────────────────────────────────────

async function getProfileById(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, email, role, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return profileToAuthUser(data);
}

// ─── Mise à jour avatar ──────────────────────────────────────────────────────

export async function updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
