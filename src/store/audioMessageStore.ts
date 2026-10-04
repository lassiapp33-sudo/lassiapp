import { create } from 'zustand';
import { Audio } from 'expo-av';

// Son du bouton "Écoute le message" — vit hors du cycle React pour survivre à la navigation.
// Le composant AudioFloatingButton lit ce store; son unmount ne tue pas la lecture.

interface AudioMessageState {
  playing: boolean;
  _sound: Audio.Sound | null;
  toggle: (source: Parameters<typeof Audio.Sound.createAsync>[0] | null) => Promise<void>;
  _onFinish: () => void;
}

const useAudioMessageStore = create<AudioMessageState>()((set, get) => ({
  playing: false,
  _sound: null,

  _onFinish: () => {
    get()._sound?.unloadAsync().catch(() => {});
    set({ playing: false, _sound: null });
  },

  toggle: async (source) => {
    const { playing, _sound, _onFinish } = get();

    if (playing && _sound) {
      await _sound.stopAsync().catch(() => {});
      await _sound.unloadAsync().catch(() => {});
      set({ playing: false, _sound: null });
      return;
    }

    if (!source) return;

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
      set({ playing: true, _sound: sound });
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          _onFinish();
        }
      });
    } catch {
      // source audio indisponible
    }
  },
}));

export default useAudioMessageStore;
