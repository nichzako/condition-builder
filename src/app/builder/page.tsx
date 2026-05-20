import { Suspense } from 'react'
import { BuilderClient } from '@/components/builder/BuilderClient'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function BuilderPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">
            Loading...
          </div>
        }
      >
        <BuilderClient />
      </Suspense>
    </ErrorBoundary>
  )
}
