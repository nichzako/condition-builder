'use client'

import { useState, useRef, useEffect } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import type { TableSource, FieldDef } from '@/types'

// --- FieldChip ---

interface FieldChipProps {
  field: FieldDef
  onRemove: () => void
}

function FieldChip({ field, onRemove }: FieldChipProps) {
  return (
    // data-field-id retained for Phase 5 drag handle
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 text-xs text-zinc-700 group cursor-default"
      data-field-id={field.id}
    >
      <span className="truncate max-w-[110px]">{field.name}</span>
      <button
        type="button"
        aria-label={`Remove field ${field.name}`}
        onClick={onRemove}
        className="shrink-0 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity leading-none"
      >
        ×
      </button>
    </div>
  )
}

// --- AddFieldRow ---

interface AddFieldRowProps {
  onAdd: (name: string) => void
  onCancel: () => void
}

function AddFieldRow({ onAdd, onCancel }: AddFieldRowProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onAdd(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={submit}
      placeholder="Field name…"
      className="w-full text-xs border border-zinc-300 rounded px-2 py-1 outline-none focus:border-zinc-500 bg-white"
    />
  )
}

// --- TableCard ---

interface TableCardProps {
  table: TableSource
  onRemove: () => void
  onAddField: (name: string) => void
  onRemoveField: (fieldId: string) => void
  onRename: (name: string) => void
}

function TableCard({ table, onRemove, onAddField, onRemoveField, onRename }: TableCardProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(table.name)
  const [addingField, setAddingField] = useState(false)

  // Keep nameValue in sync if parent renames via store rehydration
  useEffect(() => {
    setNameValue(table.name)
  }, [table.name])

  const submitName = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== table.name) onRename(trimmed)
    else setNameValue(table.name)
    setEditingName(false)
  }

  return (
    <div className="flex flex-col w-44 shrink-0 rounded-lg border border-zinc-200 bg-white p-3 gap-2">
      {/* Card header */}
      <div className="flex items-center justify-between gap-1 min-h-[20px]">
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitName()
              if (e.key === 'Escape') {
                setNameValue(table.name)
                setEditingName(false)
              }
            }}
            onBlur={submitName}
            className="flex-1 min-w-0 text-xs font-medium border-b border-zinc-400 outline-none bg-transparent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            title="Click to rename"
            className="flex-1 min-w-0 text-xs font-medium text-zinc-800 truncate text-left hover:text-zinc-500"
          >
            {table.name}
          </button>
        )}

        <div className="flex items-center shrink-0">
          <button
            type="button"
            aria-label={`Add field to ${table.name}`}
            onClick={() => setAddingField(true)}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-700 text-base leading-none rounded hover:bg-zinc-100"
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Remove table ${table.name}`}
            onClick={onRemove}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-500 text-base leading-none rounded hover:bg-zinc-100"
          >
            ×
          </button>
        </div>
      </div>

      {/* Field list */}
      <div className="flex flex-col gap-1">
        {table.fields.map((field) => (
          <FieldChip key={field.id} field={field} onRemove={() => onRemoveField(field.id)} />
        ))}
        {addingField && (
          <AddFieldRow
            onAdd={(name) => {
              onAddField(name)
              setAddingField(false)
            }}
            onCancel={() => setAddingField(false)}
          />
        )}
        {table.fields.length === 0 && !addingField && (
          <p className="text-xs text-zinc-400 italic">No fields</p>
        )}
      </div>
    </div>
  )
}

// --- FieldPanel ---

export function FieldPanel() {
  const { state, addTable, removeTable, updateTable } = useBuilderStore()

  const handleAddTable = () => {
    addTable({
      id: crypto.randomUUID(),
      name: `Table ${state.tables.length + 1}`,
      type: 'table',
      fields: [],
    })
  }

  const handleAddField = (tableId: string, name: string) => {
    const table = state.tables.find((t) => t.id === tableId)
    if (!table) return
    const newField: FieldDef = {
      id: crypto.randomUUID(),
      name,
      dataType: 'number',
    }
    updateTable(tableId, { fields: [...table.fields, newField] })
  }

  const handleRemoveField = (tableId: string, fieldId: string) => {
    const table = state.tables.find((t) => t.id === tableId)
    if (!table) return
    updateTable(tableId, { fields: table.fields.filter((f) => f.id !== fieldId) })
  }

  return (
    <section aria-labelledby="field-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span id="field-panel-heading" className="text-sm font-medium text-zinc-700">
          Fields
        </span>
        <button
          type="button"
          onClick={handleAddTable}
          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1 transition-colors"
        >
          Add Field +
        </button>
      </div>

      {state.tables.length === 0 ? (
        <p className="text-xs text-zinc-400">No fields added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {state.tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onRemove={() => removeTable(table.id)}
              onAddField={(name) => handleAddField(table.id, name)}
              onRemoveField={(fieldId) => handleRemoveField(table.id, fieldId)}
              onRename={(name) => updateTable(table.id, { name })}
            />
          ))}
        </div>
      )}
    </section>
  )
}
