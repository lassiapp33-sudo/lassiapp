import { create } from 'zustand';

// Lecture audio des commandes (lecture à voix haute) — une seule à la fois.
// Stocke l'id de la commande en cours de lecture pour synchroniser le bouton
// play/stop de chaque OrderCard.
interface SpeechState {
  speakingOrderId: string | null;
  setSpeakingOrderId: (id: string | null) => void;
}

const useSpeechStore = create<SpeechState>()(set => ({
  speakingOrderId: null,
  setSpeakingOrderId: id => set({ speakingOrderId: id }),
}));

export default useSpeechStore;
