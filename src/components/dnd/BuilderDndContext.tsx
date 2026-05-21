'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { FieldRef } from '@/types'

type DropHandler = (fieldRef: FieldRef) => void

const DRAG_ACTIVATION_DISTANCE_PX = 8

function isFieldRef(value: unknown): value is FieldRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FieldRef).tableId === 'string' &&
    typeof (value as FieldRef).fieldId === 'string' &&
    typeof (value as FieldRef).label === 'string'
  )
}

interface DndCtxValue {
  registerHandler: (slotId: string, handler: DropHandler) => () => void
  activeFieldRef: FieldRef | null
}

const BuilderDndCtx = createContext<DndCtxValue | null>(null)

export function useDndContext(): DndCtxValue {
  const ctx = useContext(BuilderDndCtx)
  if (!ctx) throw new Error('useDndContext must be used within BuilderDndContext')
  return ctx
}

/** Register a drop handler for a specific slot id. Unregisters on unmount. */
export function useDndDropHandler(slotId: string, onDrop: DropHandler) {
  const { registerHandler } = useDndContext()
  const onDropRef = useRef(onDrop)

  useEffect(() => {
    onDropRef.current = onDrop
  })

  useEffect(() => {
    return registerHandler(slotId, (fieldRef) => onDropRef.current(fieldRef))
  }, [slotId, registerHandler])
}

function DragGhost({ fieldRef }: { fieldRef: FieldRef }) {
  return (
    <div className="inline-flex items-center px-2 py-1 rounded bg-zinc-800 text-xs text-white shadow-lg cursor-grabbing select-none">
      {fieldRef.label}
    </div>
  )
}

export function BuilderDndContext({ children }: { children: React.ReactNode }) {
  const [activeFieldRef, setActiveFieldRef] = useState<FieldRef | null>(null)
  const handlers = useRef(new Map<string, DropHandler>())

  const registerHandler = useCallback((slotId: string, handler: DropHandler) => {
    handlers.current.set(slotId, handler)
    return () => handlers.current.delete(slotId)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
  )

  const onDragStart = ({ active }: DragStartEvent) => {
    const fieldRef = active.data.current?.fieldRef
    setActiveFieldRef(isFieldRef(fieldRef) ? fieldRef : null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveFieldRef(null)
    if (!over) return
    const fieldRef = active.data.current?.fieldRef
    if (!isFieldRef(fieldRef)) return
    handlers.current.get(over.id as string)?.(fieldRef)
  }

  return (
    <BuilderDndCtx.Provider value={{ registerHandler, activeFieldRef }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveFieldRef(null)}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeFieldRef ? <DragGhost fieldRef={activeFieldRef} /> : null}
        </DragOverlay>
      </DndContext>
    </BuilderDndCtx.Provider>
  )
}
