'use client'

export function PreviewBox() {
  return (
    <section aria-labelledby="preview-heading" className="p-6 flex-1 bg-zinc-100">
      <div className="flex items-center mb-4">
        <span id="preview-heading" className="text-sm font-medium text-zinc-700">
          Preview
        </span>
      </div>
      <p className="text-xs text-zinc-400">Run the formula to see output here.</p>
    </section>
  )
}
