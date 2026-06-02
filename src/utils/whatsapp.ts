import { Linking, Alert } from 'react-native';

/**
 * Normalise un numéro sénégalais vers le format E.164 sans le +
 * attendu par wa.me et whatsapp://send.
 * Exemples :
 *   "78 137 61 61"  → "221781376161"
 *   "781376161"     → "221781376161"
 *   "+221781376161" → "221781376161"
 *   "00221781376161"→ "221781376161"
 */
export function normalizePhoneSN(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, ''); // retire tout sauf les chiffres
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('221'))  { /* indicatif déjà présent */ }
  else if (d.startsWith('0')) d = '221' + d.slice(1);
  else if (d.length === 9)    d = '221' + d;  // format local 9 chiffres
  if (!/^221\d{9}$/.test(d)) return null;
  return d; // ex : 221781376161
}

/**
 * Ouvre WhatsApp sur le numéro donné, prêt à appeler (1 tap dans WhatsApp).
 * Si WhatsApp n'est pas installé → propose l'appel téléphonique classique.
 */
export async function openWhatsAppCall(rawPhone: string | null | undefined): Promise<void> {
  const num = normalizePhoneSN(rawPhone);
  if (!num) {
    Alert.alert('Appel impossible', 'Numéro de contact indisponible.');
    return;
  }

  const waScheme = `whatsapp://send?phone=${num}`;
  const waWeb    = `https://wa.me/${num}`;
  const tel      = `tel:+${num}`;

  try {
    const canWA = await Linking.canOpenURL(waScheme);
    if (canWA) {
      await Linking.openURL(waScheme);
      return;
    }
    // WhatsApp non installé → propose l'appel normal
    Alert.alert(
      'Appel impossible',
      "WhatsApp n'est pas installé sur ton téléphone.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Appeler quand même', onPress: () => Linking.openURL(tel) },
      ],
    );
  } catch {
    // Dernier recours : wa.me dans le navigateur
    Linking.openURL(waWeb).catch(() =>
      Alert.alert('Appel impossible', "Impossible d'ouvrir WhatsApp."),
    );
  }
}
