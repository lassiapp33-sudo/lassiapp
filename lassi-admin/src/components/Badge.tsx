import React from 'react'

type Variant = 'vip-scoring' | 'vip-manual' | 'reco-paid' | 'reco-manual' |
               'open' | 'in_review' | 'resolved' | 'rejected' | 'client' | 'merchant'

const STYLES: Record<Variant, string> = {
  'vip-scoring': 'bg-accent/20 text-accent border border-accent/30',
  'vip-manual':  'bg-orange/20 text-orange border border-orange/30',
  'reco-paid':   'bg-success/20 text-success border border-success/30',
  'reco-manual': 'bg-muted/20 text-muted border border-muted/30',
  'open':        'bg-danger/20 text-danger border border-danger/30',
  'in_review':   'bg-orange/20 text-orange border border-orange/30',
  'resolved':    'bg-success/20 text-success border border-success/30',
  'rejected':    'bg-muted/20 text-muted border border-muted/30',
  'client':      'bg-border/60 text-muted',
  'merchant':    'bg-accent/10 text-accent',
}

const LABELS: Record<Variant, string> = {
  'vip-scoring': '🏆 VIP scoring',
  'vip-manual':  '✋ VIP manuel',
  'reco-paid':   '💰 Reco payée',
  'reco-manual': '✋ Reco offerte',
  'open':        'Ouvert',
  'in_review':   'En examen',
  'resolved':    'Résolu',
  'rejected':    'Rejeté',
  'client':      'Client',
  'merchant':    'Prestataire',
}

interface Props {
  variant: Variant
  label?:  string
}

export default function Badge({ variant, label }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[variant]}`}>
      {label ?? LABELS[variant]}
    </span>
  )
}
