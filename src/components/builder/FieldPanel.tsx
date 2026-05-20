'use client'

export function FieldPanel() {
  return (
    <section aria-labelledby="field-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span id="field-panel-heading" className="text-sm font-medium text-zinc-700">
          Fields
        </span>
        <button
          type="button"
          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1"
        >
          Add Field +
        </button>
      </div>
      <p className="text-xs text-zinc-400">No fields added yet.</p>
    </section>
  )
}
