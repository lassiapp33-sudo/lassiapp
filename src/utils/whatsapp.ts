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
  if (d.startsWith('221')) {
    /* indicatif déjà présent */
  } else if (d.startsWith('0')) d = '221' + d.slice(1);
  else if (d.length === 9) d = '221' + d; // format local 9 chiffres
  if (!/^221\d{9}$/.test(d)) return null;
  return d; // ex : 221781376161
}

/**
 * Ouvre directement le composeur téléphonique du téléphone.
 * Quitte l'app et lance l'appel natif sans passer par WhatsApp.
 * Essaie d'abord la normalisation sénégalaise, puis tente le numéro brut
 * si suffisamment de chiffres sont présents.
 */
export async function openDirectPhoneCall(rawPhone: string | null | undefined): Promise<void> {
  if (!rawPhone) {
    Alert.alert('Appel impossible', 'Numéro de contact indisponible.');
    return;
  }

  const normalized = normalizePhoneSN(rawPhone);
  const digits = String(rawPhone).replace(/[^\d+]/g, '');
  // Utilise le numéro normalisé si possible, sinon le brut (au moins 8 chiffres)
  const dialStr = normalized
    ? `+${normalized}`
    : digits.length >= 8
      ? digits.startsWith('+')
        ? digits
        : `+${digits}`
      : null;

  if (!dialStr) {
    Alert.alert('Appel impossible', 'Numéro de contact indisponible.');
    return;
  }

  const tel = `tel:${dialStr}`;
  try {
    await Linking.openURL(tel);
  } catch {
    Alert.alert('Appel impossible', "Impossible d'ouvrir le composeur téléphonique.");
  }
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
  const waWeb = `https://wa.me/${num}`;
  const tel = `tel:+${num}`;

  try {
    const canWA = await Linking.canOpenURL(waScheme);
    if (canWA) {
      await Linking.openURL(waScheme);
      return;
    }
    Alert.alert('Appel impossible', "WhatsApp n'est pas installé sur ton téléphone.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Appeler quand même', onPress: () => Linking.openURL(tel) },
    ]);
  } catch {
    Linking.openURL(waWeb).catch(() =>
      Alert.alert('Appel impossible', "Impossible d'ouvrir WhatsApp."),
    );
  }
}
