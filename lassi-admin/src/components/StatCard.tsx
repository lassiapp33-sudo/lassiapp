import React from 'react'

interface Props {
  label:    string
  value:    string
  sub?:     string
  icon?:    React.ReactNode
  accent?:  boolean
  loading?: boolean
}

export default function StatCard({ label, value, sub, icon, accent, loading }: Props) {
  return (
    <div className={`
      bg-surface border rounded-xl p-5 flex flex-col gap-3
      ${accent ? 'border-accent/30' : 'border-border'}
    `}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <span className={`p-2 rounded-lg ${accent ? 'bg-accent/10 text-accent' : 'bg-border/50 text-muted'}`}>
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 bg-border/50 rounded animate-pulse w-2/3" />
      ) : (
        <p className={`text-2xl font-title font-bold ${accent ? 'text-accent' : 'text-white'}`}>
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="text-xs text-muted">{sub}</p>
      )}
    </div>
  )
}
