'use client'

export function ActionPanel() {
  return (
    <section className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-zinc-700">Actions</span>
        <button className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1">
          +
        </button>
      </div>
      <p className="text-xs text-zinc-400">— Phase 4: New / select field actions —</p>
    </section>
  )
}
