/**
 * contact.ts — Source de vérité unique pour le contact service client LASSİ.
 * Modifier ICI si le numéro/canal change. Tous les écrans importent depuis ce fichier.
 */
import { Linking, Alert } from 'react-native';

export const WHATSAPP_SERVICE_CLIENT = 'https://wa.me/221761890003';
export const NUMERO_SERVICE_CLIENT_AFFICHE = '+221 76 189 00 03';
export const SUPPORT_EMAIL = 'lassiapp33@gmail.com';

/**
 * Ouvre WhatsApp sur la conversation service client.
 * Si WhatsApp n'est pas installé, affiche une alerte avec le numéro en secours.
 */
export async function contacterServiceClient(message?: string): Promise<void> {
  const url = message
    ? `${WHATSAPP_SERVICE_CLIENT}?text=${encodeURIComponent(message)}`
    : WHATSAPP_SERVICE_CLIENT;

  const ok = await Linking.canOpenURL(url);
  if (ok) {
    Linking.openURL(url);
  } else {
    Alert.alert('WhatsApp indisponible', `Contacte-nous au ${NUMERO_SERVICE_CLIENT_AFFICHE}`, [
      {
        text: 'Appeler',
        onPress: () => Linking.openURL(`tel:+221761890003`),
      },
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
