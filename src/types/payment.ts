// Types partagés pour le module Paiement
import { OrderLineItem } from './orders';

/** Alias de OrderLineItem — conservé pour rétrocompatibilité avec les écrans de paiement. */
export type OrderItem = OrderLineItem;

export interface OrderInfo {
  ticketId: string; // ID du message ticket dans le chat (pour le retour)
  orderId: string; // ex : "#A427"
  shopInitial: string;
  shopName: string;
  shopLocation: string; // ex : "📍 Medina"
  items: OrderItem[];
  total: number;
  /** Frais de service LASSİ (10%) déjà inclus dans `total`. */
  commission?: number;
  orderType?: 'place' | 'emporter';
  /** Méthode et piId déjà initiés depuis CartScreen — PaymentScreen démarre en waiting. */
  preMethod?: PayMethod;
  preInitiatedPiId?: string;
  /** Paiement déjà confirmé côté serveur (simulation) — PaymentScreen démarre en confirm. */
  paymentConfirmed?: boolean;
  /** QR code base64 Orange Money — affiché dans WaitingView si pas de deep link. */
  qrCode?: string;
  /** URL de paiement Wave/OM — pour le bouton "Rouvrir" dans WaitingView. */
  paymentUrl?: string;
}

export type PayMethod = 'wave' | 'om';
