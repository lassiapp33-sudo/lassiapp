import React from 'react'

interface Props {
  icon?:    React.ReactNode
  title:    string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="text-border mb-4 opacity-60">{icon}</div>
      )}
      <p className="text-white font-medium text-base">{title}</p>
      {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
    </div>
  )
}
