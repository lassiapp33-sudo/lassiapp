import { Platform, Linking, Alert } from 'react-native';

export const ouvrirNavigation = async (params: {
  latitude?: number | null;
  longitude?: number | null;
  adresse?: string | null;
  nomLieu?: string | null;
}) => {
  const { latitude, longitude, adresse, nomLieu } = params;

  let url = '';

  if (latitude && longitude) {
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${latitude},${longitude}&dirflg=d`;
    } else {
      url = `google.navigation:q=${latitude},${longitude}`;
    }
  } else if (adresse) {
    const query = encodeURIComponent(adresse);
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${query}`;
    } else {
      url = `google.navigation:q=${query}`;
    }
  } else {
    Alert.alert('Adresse manquante', "Ce prestataire n'a pas indiqué sa localisation.");
    return;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      const fallback =
        latitude && longitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse ?? '')}`;
      await Linking.openURL(fallback);
    }
  } catch {
    Alert.alert('Erreur', "Impossible d'ouvrir la navigation.");
  }
};

export const voirSurCarte = async (params: {
  latitude?: number | null;
  longitude?: number | null;
  adresse?: string | null;
  nomLieu?: string | null;
}) => {
  const { latitude, longitude, adresse, nomLieu } = params;
  let url = '';

  if (latitude && longitude) {
    const label = encodeURIComponent(nomLieu ?? 'Destination');
    if (Platform.OS === 'ios') {
      url = `maps://app?ll=${latitude},${longitude}&q=${label}`;
    } else {
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    }
  } else if (adresse) {
    const query = encodeURIComponent(adresse);
    url = Platform.OS === 'ios' ? `maps://app?q=${query}` : `geo:0,0?q=${query}`;
  }

  try {
    if (url) await Linking.openURL(url);
  } catch {
    const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse ?? `${latitude},${longitude}`)}`;
    await Linking.openURL(fallback);
  }
};
