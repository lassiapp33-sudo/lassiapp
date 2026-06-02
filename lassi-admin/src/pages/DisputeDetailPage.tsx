/**
 * DisputeDetailPage — Vue détail d'un litige : contexte, fil de discussion, arbitrage.
 */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate }      from 'react-router-dom'
import { ArrowLeft, Send, Check, X }  from 'lucide-react'
import Badge from '../components/Badge'
import {
  getDisputeById, getDisputeMessages, resolveDispute, addAdminMessage,
  REASON_LABELS, STATUS_LABELS,
  type Dispute, type DisputeMessage, type DisputeStatus,
} from '../services/disputes'

const SENDER_STYLES: Record<string, string> = {
  admin:    'bg-accent/10 border border-accent/20 ml-auto',
  client:   'bg-surface border border-border',
  merchant: 'bg-surface border border-border',
}

export default function DisputeDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dispute,   setDispute]   = useState<Dispute | null>(null)
  const [messages,  setMessages]  = useState<DisputeMessage[]>([])
  const [loading,   setLoading]   = useState(true)

  const [newMsg,    setNewMsg]    = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const [resolution, setResolution] = useState('')
  const [newStatus,  setNewStatus]  = useState<DisputeStatus>('resolved')
  const [resolving,  setResolving]  = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [feedback,   setFeedback]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function load() {
    if (!id) return
    setLoading(true)
    Promise.all([getDisputeById(id), getDisputeMessages(id)])
      .then(([d, m]) => {
        setDispute(d)
        setMessages(m)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleSendMessage() {
    if (!id || !newMsg.trim()) return
    setSendingMsg(true)
    try {
      await addAdminMessage(id, newMsg.trim())
      setNewMsg('')
      load()
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message })
    } finally {
      setSendingMsg(false)
    }
  }

  async function handleResolve() {
    if (!id || !resolution.trim()) return
    setResolving(true)
    try {
      await resolveDispute({
        disputeId:  id,
        status:     newStatus,
        resolution: resolution.trim(),
        message:    `Décision admin : ${resolution.trim()}`,
      })
      setFeedback({ type: 'ok', text: 'Litige arbitré avec succès.' })
      setShowForm(false)
      load()
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message })
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <p className="text-muted">Litige introuvable.</p>
      </div>
    )
  }

  const isOpen = ['open', 'in_review'].includes(dispute.status)

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      {/* Retour */}
      <button
        onClick={() => navigate('/disputes')}
        className="flex items-center gap-2 text-muted hover:text-white text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Retour aux litiges
      </button>

      {/* En-tête */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-title font-bold text-white">
            Litige — {dispute.type === 'order' ? 'Commande' : 'Dette'}
          </h1>
          <Badge variant={dispute.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted text-xs">Plaignant</span>
            <p className="text-white">{dispute.reporterName} <span className="text-muted capitalize">({dispute.reporterRole})</span></p>
          </div>
          <div>
            <span className="text-muted text-xs">Partie visée</span>
            <p className="text-white">{dispute.againstName}</p>
          </div>
          {dispute.shopName && (
            <div>
              <span className="text-muted text-xs">Commerce</span>
              <p className="text-white">{dispute.shopName}</p>
            </div>
          )}
          <div>
            <span className="text-muted text-xs">Motif</span>
            <p className="text-white">{REASON_LABELS[dispute.reason]}</p>
          </div>
          <div>
            <span className="text-muted text-xs">Date</span>
            <p className="text-white">{new Date(dispute.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}</p>
          </div>
        </div>

        {/* Description du plaignant */}
        <div className="bg-bg rounded-lg p-3 border border-border">
          <p className="text-xs text-muted mb-1">Description du plaignant</p>
          <p className="text-white text-sm">{dispute.description}</p>
        </div>

        {/* Preuves photos */}
        {dispute.evidenceUrls.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2">Preuves ({dispute.evidenceUrls.length})</p>
            <div className="flex gap-2 flex-wrap">
              {dispute.evidenceUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`Preuve ${i + 1}`}
                    className="w-16 h-16 object-cover rounded border border-border hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Résolution existante */}
        {dispute.resolution && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-3">
            <p className="text-xs text-success mb-1">Décision de l'admin</p>
            <p className="text-white text-sm">{dispute.resolution}</p>
            {dispute.resolvedAt && (
              <p className="text-muted text-xs mt-1">
                {new Date(dispute.resolvedAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fil de discussion */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-white font-semibold text-sm">Fil de discussion</h2>
        </div>
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">Aucun message encore.</p>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`max-w-md rounded-xl px-4 py-3 text-sm ${SENDER_STYLES[msg.senderRole]}`}
              >
                <p className={`text-xs font-medium mb-1 ${
                  msg.senderRole === 'admin' ? 'text-accent' : 'text-muted'
                }`}>
                  {msg.senderRole === 'admin' ? '🛡 Admin' : msg.senderName}
                </p>
                <p className="text-white">{msg.message}</p>
                <p className="text-muted text-xs mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Envoyer un message admin */}
        {isOpen && (
          <div className="px-4 pb-4 flex gap-2 border-t border-border pt-3">
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Message admin visible des parties…"
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-accent placeholder-muted"
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMsg || !newMsg.trim()}
              className="bg-accent text-bg px-3 py-2 rounded-lg hover:bg-accent/90 transition-colors
                         disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
          feedback.type === 'ok'
            ? 'bg-success/10 border border-success/30'
            : 'bg-danger/10 border border-danger/30'
        }`}>
          {feedback.type === 'ok' ? <Check size={16} className="text-success" /> : <X size={16} className="text-danger" />}
          <span className={`text-sm ${feedback.type === 'ok' ? 'text-success' : 'text-danger'}`}>
            {feedback.text}
          </span>
        </div>
      )}

      {/* Actions d'arbitrage */}
      {isOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Trancher le litige</h2>

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors"
            >
              Rendre une décision
            </button>
          ) : (
            <div className="space-y-4">
              {/* Statut */}
              <div>
                <label className="block text-xs text-muted font-medium mb-2 uppercase tracking-wide">
                  Décision
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['resolved', 'rejected', 'in_review'] as DisputeStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setNewStatus(s)}
                      className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                        newStatus === s
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'border-border text-muted hover:border-muted'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Texte de résolution */}
              <div>
                <label className="block text-xs text-muted font-medium mb-2 uppercase tracking-wide">
                  Motivation de la décision
                </label>
                <textarea
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  rows={3}
                  placeholder="Détaille ta décision — visible des deux parties…"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                             focus:outline-none focus:border-accent placeholder-muted resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="border border-border text-muted px-4 py-2.5 rounded-lg text-sm hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolving || !resolution.trim()}
                  className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm
                             hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {resolving ? 'Enregistrement…' : 'Confirmer la décision'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
