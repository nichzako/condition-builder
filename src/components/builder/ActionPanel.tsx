'use client'

export function ActionPanel() {
  return (
    <section aria-labelledby="action-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 id="action-panel-heading" className="text-sm font-medium text-zinc-700">
          Actions
        </h2>
        <button
          type="button"
          aria-label="Add action"
          disabled
          title="Actions — coming soon"
          className="text-xs text-zinc-300 border border-zinc-100 rounded px-2 py-1 cursor-not-allowed"
        >
          +
        </button>
      </div>
      <p className="text-xs text-zinc-400">No actions added yet.</p>
    </section>
  )
}
