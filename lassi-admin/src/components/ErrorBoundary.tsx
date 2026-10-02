import React from 'react'

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg gap-4 p-6 text-center">
        <p className="text-red-400 font-semibold text-base">Une erreur inattendue s'est produite</p>
        <p className="text-muted text-sm max-w-sm">{this.state.error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent text-bg rounded-lg text-sm font-medium mt-2"
        >
          Recharger la page
        </button>
      </div>
    )
  }
}
