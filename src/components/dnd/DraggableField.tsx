'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { FieldRef } from '@/types'

interface DraggableFieldProps {
  fieldRef: FieldRef
  children: React.ReactNode
}

export function DraggableField({ fieldRef, children }: DraggableFieldProps) {
  const id = `${fieldRef.tableId}:${fieldRef.fieldId}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { fieldRef },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'opacity-40 cursor-grabbing' : 'cursor-grab'}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}
