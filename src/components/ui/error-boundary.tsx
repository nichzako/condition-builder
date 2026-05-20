'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
            Something went wrong.{' '}
            <button
              type="button"
              className="ml-2 underline hover:text-zinc-800"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
