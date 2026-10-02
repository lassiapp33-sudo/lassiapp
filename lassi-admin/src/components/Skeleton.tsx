import React from 'react'

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-border/60 rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-border/60 rounded w-1/3 mb-3" />
      <div className="h-8 bg-border/60 rounded w-2/3" />
    </div>
  )
}
