import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { ChatMessage, rowToMessage } from '../services/chat';

/**
 * Abonnement Realtime sur la table messages, filtré par conversationId.
 * Se désabonne automatiquement au démontage.
 * Se ré-abonne quand l'app revient au premier plan (reconnexion réseau).
 */
export function useRealtimeMessages(
  conversationId: string | null,
  onInsert: (msg: ChatMessage) => void,
  onUpdate: (msg: ChatMessage) => void,
) {
  // On garde les callbacks en ref pour éviter de recréer le channel à chaque render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!conversationId) return;

    const subscribe = () => {
      const channel = supabase
        .channel(`msgs:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          payload => onInsertRef.current(rowToMessage(payload.new)),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          payload => onUpdateRef.current(rowToMessage(payload.new)),
        )
        .subscribe();
      return channel;
    };

    let channel = subscribe();

    // Reconnexion quand l'app repasse au premier plan.
    // getSession() garantit un JWT frais AVANT de re-souscrire : sinon le socket
    // rejoint avec un token expiré → join rejeté → aucun message ne remonte.
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') return;
      await supabase.auth.getSession();
      supabase.removeChannel(channel);
      channel = subscribe();
    });

    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
