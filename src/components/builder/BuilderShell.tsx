'use client'

import { useCallback, useMemo, useState } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { trpc } from '@/lib/trpc/client'
import { FieldPanel } from '@/components/builder/FieldPanel'
import { ConditionPanel } from '@/components/builder/ConditionPanel'
import { ActionPanel } from '@/components/builder/ActionPanel'
import { ResultPanel } from '@/components/builder/ResultPanel'
import { PreviewBox, type RunResult } from '@/components/builder/PreviewBox'
import { Button } from '@/components/ui/button'
import { BuilderDndContext } from '@/components/dnd/BuilderDndContext'
import type { TableSource } from '@/types'
import type { DataContext } from '@/lib/formula-engine'

// --- Helpers ---

function buildDefaultContext(tables: TableSource[], existing: DataContext): DataContext {
  const ctx: DataContext = {}
  tables.forEach((table, ti) => {
    ctx[table.id] = {}
    table.fields.forEach((field, fi) => {
      const prev = existing[table.id]?.[field.id]
      ctx[table.id][field.id] =
        prev !== undefined ? prev : field.dataType === 'string' ? `sample_${fi + 1}` : 1
    })
  })
  return ctx
}

// --- SaveIndicator ---

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
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={`text-xs transition-colors duration-150 ${color}`}
    >
      {label}
    </span>
  )
}

// --- BuilderShell ---

export function BuilderShell() {
  const { name, state } = useBuilderStore()
  // User-edited overrides — new fields get defaults, removed tables are silently ignored
  const [mockOverrides, setMockOverrides] = useState<DataContext>({})
  const mockContext = useMemo(
    () => buildDefaultContext(state.tables, mockOverrides),
    [state.tables, mockOverrides],
  )
  const [runResult, setRunResult] = useState<RunResult | null>(null)

  const evaluate = trpc.formula.evaluate.useMutation({
    onSuccess: (data) => setRunResult(data),
  })

  const handleRun = useCallback(() => {
    evaluate.mutate({ state, context: mockContext })
  }, [evaluate, state, mockContext])

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-zinc-900">{name}</h1>
          <SaveIndicator />
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={handleRun}
          disabled={evaluate.isPending}
          aria-busy={evaluate.isPending}
        >
          {evaluate.isPending ? 'Running...' : 'RUN'}
        </Button>
      </header>

      {/* Panels — wrapped in DndContext so all panels share drag state */}
      <BuilderDndContext>
        <main className="flex flex-col flex-1 divide-y divide-zinc-200">
          <FieldPanel />
          <ConditionPanel />
          <ActionPanel />
          <ResultPanel />
          <PreviewBox
            tables={state.tables}
            mockContext={mockContext}
            onContextChange={(tableId, fieldId, value) =>
            setMockOverrides((prev) => ({
              ...prev,
              [tableId]: { ...prev[tableId], [fieldId]: value },
            }))
          }
            runResult={runResult}
            isPending={evaluate.isPending}
          />
        </main>
      </BuilderDndContext>
    </div>
  )
}
