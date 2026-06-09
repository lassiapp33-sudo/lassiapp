/**
 * services/account.ts — Suppression de compte.
 *
 * Appelle l'Edge Function delete-account (service_role côté serveur)
 * qui supprime toutes les données et libère le numéro/email pour une
 * future réinscription.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import useShopStore from '../store/shopStore';
import useOrdersStore from '../store/ordersStore';
import useDebtsStore from '../store/debtsStore';
import useFavoritesStore from '../store/favoritesStore';
import useNotificationsStore from '../store/notificationsStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Supprime définitivement le compte de l'utilisateur connecté.
 * Après succès, déconnecte et vide tous les stores locaux.
 */
export async function deleteAccount(): Promise<void> {
  // Récupérer le token de session pour l'Edge Function
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi.');

  // Appeler l'Edge Function (service_role côté serveur, jamais exposé à l'app)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'La suppression a échoué. Réessaie.');
  }

  // ── Nettoyage local ────────────────────────────────────────────────────────

  // Déconnecter Supabase Auth côté client
  await supabase.auth.signOut();

  // Vider tous les stores Zustand
  useAuthStore.getState().logout();
  useShopStore.setState({
    shopId: null,
    profile: { initial: 'M', name: 'Ma Boutique', subtitle: '', isOpen: true },
    context: { shopType: 'products', openingHours: null, isManuallyClose: false, galleryUrls: [], subcategories: [] },
    categories: [],
    products: [],
    loading: false,
    shopNotFound: false,
  });
  useOrdersStore.setState({ orders: [], shopId: null, loading: false });
  useDebtsStore.setState({ debtors: [], shopId: null, loading: false });
  useFavoritesStore.setState({ favorites: [], loading: false });
  useNotificationsStore.setState({ notifications: [], loading: false });

  // Effacer tout AsyncStorage (session Supabase persistée + préférences)
  await AsyncStorage.clear();
}
