'use client'

export function FieldPanel() {
  return (
    <section className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-zinc-700">Fields</span>
        <button className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1">
          Add Field +
        </button>
      </div>
      <p className="text-xs text-zinc-400">— Phase 4: Table cards + field chips —</p>
    </section>
  )
}
