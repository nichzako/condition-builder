import { Suspense } from 'react'
import { BuilderClient } from '@/components/builder/BuilderClient'

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <BuilderClient />
    </Suspense>
  )
}
