import { create } from 'zustand';
import * as locationService from '../services/location';

export interface UserCoords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coords: UserCoords | null;
  zoneName: string;
  loading: boolean;

  /** Demande la permission GPS, récupère la position et le nom de zone. */
  refreshLocation: () => Promise<void>;
}

const useLocationStore = create<LocationState>()(set => ({
  coords: null,
  zoneName: 'Localisation…',
  loading: false,

  refreshLocation: async () => {
    set({ loading: true, zoneName: 'Localisation…' });
    try {
      const coords = await locationService.getCurrentLocation();
      if (!coords) {
        set({ loading: false, zoneName: 'Position non disponible' });
        return;
      }
      const zoneName = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      set({ coords, zoneName, loading: false });
    } catch {
      set({ loading: false, zoneName: 'Position non disponible' });
    }
  },
}));

export default useLocationStore;
