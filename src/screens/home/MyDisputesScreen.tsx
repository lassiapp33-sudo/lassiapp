/**
 * MyDisputesScreen — Section "Mes signalements" dans le profil client.
 * Liste des litiges de l'utilisateur avec leur statut et fil de discussion.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { notifyError } from '../../utils/errorUtils';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import * as disputeService from '../../services/disputes';
import type { Dispute, DisputeMessage } from '../../services/disputes';
import logger from '../../utils/logger';
import { IcoBack } from '../../components/icons';

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'rgba(224,122,122,0.15)', text: '#E07A7A', label: 'Ouvert' },
  in_review: { bg: 'rgba(240,168,71,0.15)', text: '#F0A847', label: 'En examen' },
  resolved: { bg: 'rgba(95,211,138,0.15)', text: '#5FD38A', label: 'Résolu' },
  rejected: { bg: 'rgba(154,155,176,0.15)', text: '#9A9BB0', label: 'Rejeté' },
};

interface Props {
  onBack: () => void;
}

export default function MyDisputesScreen({ onBack }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    disputeService
      .getMyDisputes()
      .then(setDisputes)
      .catch(err => logger.warn('[MyDisputesScreen] getMyDisputes:', err))
      .finally(() => setLoading(false));
  }, []);

  const loadMessages = useCallback((id: string) => {
    disputeService
      .getDisputeMessages(id)
      .then(setMessages)
      .catch(err => logger.warn('[MyDisputesScreen] getDisputeMessages:', err));
  }, []);

  function openDispute(d: Dispute) {
    setSelected(d);
    loadMessages(d.id);
  }

  async function handleSend() {
    if (!selected || !newMsg.trim()) return;
    setSendingMsg(true);
    try {
      await disputeService.sendDisputeMessage(selected.id, newMsg.trim());
      setNewMsg('');
      loadMessages(selected.id);
    } catch {
      notifyError("Impossible d'envoyer le message. Vérifie ta connexion et réessaie.");
    } finally {
      setSendingMsg(false);
    }
  }

  // ─── Détail d'un litige ──────────────────────────────────────────────────

  if (selected) {
    const ss = STATUS_STYLE[selected.status] ?? STATUS_STYLE.open;
    const isOpen = ['open', 'in_review'].includes(selected.status);

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.head, { paddingTop: TOP_INSET + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelected(null)}
            activeOpacity={0.75}
          >
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headTitle} numberOfLines={1}>
            Litige — {selected.type === 'order' ? 'Commande' : 'Dette'}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: ss.bg }]}>
            <Text style={[styles.statusTxt, { color: ss.text }]}>{ss.label}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Contexte */}
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>{disputeService.REASON_LABELS[selected.reason]}</Text>
            <Text style={styles.contextDesc}>{selected.description}</Text>
          </View>

          {/* Résolution admin */}
          {selected.resolution && (
            <View style={styles.resolutionCard}>
              <Text style={styles.resolutionLbl}>⚖️ Décision de l'admin</Text>
              <Text style={styles.resolutionTxt}>{selected.resolution}</Text>
            </View>
          )}

          {/* Messages */}
          <Text style={styles.sectionLbl}>Fil de discussion</Text>
          {messages.length === 0 ? (
            <Text style={styles.noMsg}>Aucun message encore.</Text>
          ) : (
            messages.map(msg => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <View key={msg.id} style={[styles.msgBubble, isAdmin && styles.msgBubbleAdmin]}>
                  <Text style={[styles.msgSender, isAdmin && styles.msgSenderAdmin]}>
                    {isAdmin ? '🛡 Admin' : msg.senderName}
                  </Text>
                  <Text style={styles.msgText}>{msg.message}</Text>
                  <Text style={styles.msgTime}>
                    {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Saisie message */}
        {isOpen && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.msgInput}
              placeholder="Ajouter une précision…"
              placeholderTextColor="#5a5c80"
              value={newMsg}
              onChangeText={setNewMsg}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!newMsg.trim() || sendingMsg) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!newMsg.trim() || sendingMsg}
              activeOpacity={0.75}
            >
              <Text style={styles.sendBtnTxt}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // ─── Liste des litiges ───────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.head, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Mes signalements</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingTxt}>Chargement…</Text>
          </View>
        ) : disputes.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Aucun signalement</Text>
            <Text style={styles.emptySubtitle}>
              Tu peux signaler un problème depuis l'historique d'une commande ou d'une dette.
            </Text>
          </View>
        ) : (
          disputes.map(d => {
            const ss = STATUS_STYLE[d.status] ?? STATUS_STYLE.open;
            return (
              <TouchableOpacity
                key={d.id}
                style={styles.disputeCard}
                onPress={() => openDispute(d)}
                activeOpacity={0.75}
              >
                <View style={styles.disputeTop}>
                  <Text style={styles.disputeTitle}>
                    {d.type === 'order' ? 'Commande' : 'Dette'} — {d.shopName ?? d.againstName}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.statusTxt, { color: ss.text }]}>{ss.label}</Text>
                  </View>
                </View>
                <Text style={styles.disputeReason}>{disputeService.REASON_LABELS[d.reason]}</Text>
                <Text style={styles.disputeDate}>
                  {new Date(d.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                  })}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    flex: 1,
  },
  statusChip: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusTxt: {
    fontFamily: fonts.ui,
    fontSize: 10,
  },
  disputeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  disputeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  disputeTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
    flex: 1,
  },
  disputeReason: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 4,
  },
  disputeDate: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 11,
  },

  // Détail
  contextCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
  },
  contextTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 6,
  },
  contextDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  resolutionCard: {
    backgroundColor: 'rgba(95,211,138,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(95,211,138,0.25)',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
  },
  resolutionLbl: {
    color: colors.success,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resolutionTxt: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  noMsg: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  msgBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  msgBubbleAdmin: {
    backgroundColor: 'rgba(253,207,52,0.08)',
    borderColor: 'rgba(253,207,52,0.2)',
    alignSelf: 'flex-end',
  },
  msgSender: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 10,
    marginBottom: 4,
  },
  msgSenderAdmin: {
    color: colors.accent,
  },
  msgText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  msgTime: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 4,
  },

  // Saisie message
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.screen,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(20,21,42,0.97)',
  },
  msgInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  sendBtn: {
    width: 46,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnTxt: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 26,
  },

  // États
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
});
