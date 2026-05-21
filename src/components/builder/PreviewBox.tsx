'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { TableSource } from '@/types'
import type { DataContext } from '@/lib/formula-engine'

// --- Types ---

interface ConditionResult {
  id: string
  left: string
  operator: string
  right: string
  passes: boolean
  error?: string
}

interface FormulaResult {
  id: string
  name: string
  value: number | string
  error?: string
}

export interface RunResult {
  conditions: ConditionResult[]
  results: FormulaResult[]
}

interface PreviewBoxProps {
  tables: TableSource[]
  mockContext: DataContext
  onContextChange: (tableId: string, fieldId: string, value: number | string) => void
  runResult: RunResult | null
  isPending: boolean
}

// --- Helpers ---

const OP_LABEL: Record<string, string> = {
  equal: '=',
  not_equal: '≠',
  greater_than: '>',
  less_than: '<',
  contains: 'contains',
}

function parseValue(raw: string): number | string {
  const n = Number(raw)
  return raw.trim() !== '' && !Number.isNaN(n) ? n : raw
}

function formatValue(val: number | string): string {
  if (typeof val === 'number') {
    // Trim trailing zeros up to 4 decimal places; very small/large values may round visually
    return Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/\.?0+$/, '')
  }
  return val
}

// --- Sub-components ---

function MockDataEditor({
  tables,
  mockContext,
  onContextChange,
}: Pick<PreviewBoxProps, 'tables' | 'mockContext' | 'onContextChange'>) {
  if (tables.length === 0) {
    return <p className="text-xs text-zinc-400">Add tables in the Field panel to set up mock data.</p>
  }

  function handleChange(tableId: string, fieldId: string, raw: string) {
    onContextChange(tableId, fieldId, parseValue(raw))
  }

  return (
    <div className="space-y-3">
      {tables.map((table) => (
        <div key={table.id}>
          <p className="text-xs font-medium text-zinc-600 mb-1">{table.name}</p>
          {table.fields.length === 0 ? (
            <p className="text-xs text-zinc-400 ml-2">No fields</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {table.fields.map((field) => {
                const val = mockContext[table.id]?.[field.id] ?? ''
                return (
                  <label key={field.id} className="flex items-center gap-1 text-xs text-zinc-600">
                    <span className="shrink-0">{field.name}:</span>
                    <input
                      type={field.dataType === 'number' ? 'number' : 'text'}
                      value={String(val)}
                      onChange={(e) => handleChange(table.id, field.id, e.target.value)}
                      className="w-20 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ConditionResults({ conditions }: { conditions: ConditionResult[] }) {
  if (conditions.length === 0) {
    return (
      <p className="text-xs text-zinc-400 border border-dashed border-zinc-200 rounded px-3 py-2">
        No conditions to evaluate.
      </p>
    )
  }
  return (
    <div className="space-y-1">
      {conditions.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-xs">
          {c.passes ? (
            <CheckCircle2 className="mt-0.5 shrink-0 text-green-500" size={13} />
          ) : (
            <XCircle className="mt-0.5 shrink-0 text-red-400" size={13} />
          )}
          <span className="text-zinc-700">
            {c.left} {OP_LABEL[c.operator] ?? c.operator} {c.right}
          </span>
          {c.error && <span className="text-red-400 ml-1">({c.error})</span>}
        </div>
      ))}
    </div>
  )
}

function FormulaResults({ results }: { results: FormulaResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-xs text-zinc-400 border border-dashed border-zinc-200 rounded px-3 py-2">
        No formulas to evaluate.
      </p>
    )
  }
  return (
    <div className="space-y-1">
      {results.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-xs">
          <span className="font-medium text-zinc-700">{r.name}</span>
          <span className="text-zinc-400">=</span>
          {r.error ? (
            <span className="text-red-400">{r.error}</span>
          ) : (
            <span className="font-mono text-zinc-800">{formatValue(r.value)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// --- Main component ---

export function PreviewBox({
  tables,
  mockContext,
  onContextChange,
  runResult,
  isPending,
}: PreviewBoxProps) {
  return (
    <section aria-labelledby="preview-heading" className="p-6 bg-white border-t border-zinc-200 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 id="preview-heading" className="text-sm font-medium text-zinc-700">
          Preview
        </h2>
        {isPending && <span className="text-xs text-zinc-400">Running...</span>}
      </div>

      {/* Mock data editor */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
          Mock Data
        </p>
        <MockDataEditor
          tables={tables}
          mockContext={mockContext}
          onContextChange={onContextChange}
        />
      </div>

      {/* Results — only shown after at least one RUN */}
      {runResult && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Conditions
            </p>
            <ConditionResults conditions={runResult.conditions} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Results
            </p>
            <FormulaResults results={runResult.results} />
          </div>
        </div>
      )}

      {!runResult && !isPending && (
        <p className="text-xs text-zinc-400 border border-dashed border-zinc-200 rounded px-3 py-2">
          Click RUN to evaluate conditions and formulas.
        </p>
      )}
    </section>
  )
}
