'use client'

export function ConditionPanel() {
  return (
    <section className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-zinc-700">Condition</span>
        <button className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1">
          +
        </button>
      </div>
      <p className="text-xs text-zinc-400">— Phase 6: Condition rows with operator dropdown —</p>
    </section>
  )
}
