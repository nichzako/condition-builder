'use client'

export function ConditionPanel() {
  return (
    <section aria-labelledby="condition-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span id="condition-panel-heading" className="text-sm font-medium text-zinc-700">
          Condition
        </span>
        <button
          type="button"
          aria-label="Add condition"
          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1"
        >
          +
        </button>
      </div>
      <p className="text-xs text-zinc-400">No conditions added yet.</p>
    </section>
  )
}
