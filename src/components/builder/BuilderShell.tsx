'use client'

import { useBuilderStore } from '@/store/builder-store'
import { FieldPanel } from '@/components/builder/FieldPanel'
import { ConditionPanel } from '@/components/builder/ConditionPanel'
import { ActionPanel } from '@/components/builder/ActionPanel'
import { ResultPanel } from '@/components/builder/ResultPanel'
import { PreviewBox } from '@/components/builder/PreviewBox'
import { Button } from '@/components/ui/button'

function SaveIndicator() {
  const { saveStatus } = useBuilderStore()
  if (saveStatus === 'idle') return null
  const label =
    saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Error saving'
  const color =
    saveStatus === 'saving'
      ? 'text-zinc-400'
      : saveStatus === 'saved'
        ? 'text-green-500'
        : 'text-red-500'
  return <span className={`text-xs ${color}`}>{label}</span>
}

export function BuilderShell() {
  const { name } = useBuilderStore()

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-zinc-900">{name}</h1>
          <SaveIndicator />
        </div>
        <Button size="sm" variant="default">
          RUN
        </Button>
      </header>

      {/* Panels */}
      <main className="flex flex-col flex-1 divide-y divide-zinc-200">
        <FieldPanel />
        <ConditionPanel />
        <ActionPanel />
        <ResultPanel />
        <PreviewBox />
      </main>
    </div>
  )
}
