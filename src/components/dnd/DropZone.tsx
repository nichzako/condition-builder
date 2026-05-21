'use client'

import { useDroppable } from '@dnd-kit/core'
import { useDndDropHandler } from '@/components/dnd/BuilderDndContext'
import type { FieldRef } from '@/types'

interface DropZoneProps {
  id: string
  currentValue?: FieldRef | null
  onDrop: (fieldRef: FieldRef) => void
  placeholder?: string
}

export function DropZone({ id, currentValue, onDrop, placeholder = 'Drop field' }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  useDndDropHandler(id, onDrop)

  return (
    <div
      ref={setNodeRef}
      className={[
        'inline-flex items-center px-2 py-1 rounded border text-xs min-w-[100px] transition-colors select-none',
        isOver
          ? 'border-blue-400 bg-blue-50 text-blue-700'
          : currentValue
            ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
            : 'border-dashed border-zinc-300 text-zinc-400',
      ].join(' ')}
    >
      {currentValue ? currentValue.label : placeholder}
    </div>
  )
}
