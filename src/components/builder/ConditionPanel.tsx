'use client'

import { useState, useEffect } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { DropZone } from '@/components/dnd/DropZone'
import { OperatorSchema } from '@/lib/schema'
import type { Condition, FieldRef, LiteralValue, Operator } from '@/types'

const OPERATOR_LABELS: Record<Operator, string> = {
  equal: 'Equal',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
  not_equal: 'Not Equal',
  contains: 'Contains',
}

const OPERATORS: Operator[] = ['equal', 'greater_than', 'less_than', 'not_equal', 'contains']

const EMPTY_FIELD_REF: FieldRef = { tableId: '', fieldId: '', label: '' }

function isFieldRef(value: FieldRef | LiteralValue): value is FieldRef {
  return typeof value === 'object' && value !== null && 'tableId' in value
}

// --- OperatorSelect ---

interface OperatorSelectProps {
  value: Operator
  onChange: (op: Operator) => void
}

function OperatorSelect({ value, onChange }: OperatorSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const result = OperatorSchema.safeParse(e.target.value)
        if (result.success) onChange(result.data)
      }}
      className="text-xs border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:border-zinc-400 cursor-pointer"
    >
      {OPERATORS.map((op) => (
        <option key={op} value={op}>
          {OPERATOR_LABELS[op]}
        </option>
      ))}
    </select>
  )
}

// --- LiteralInput ---

interface LiteralInputProps {
  value: string
  onChange: (raw: string) => void
  onSwitchToField: () => void
}

function LiteralInput({ value, onChange, onSwitchToField }: LiteralInputProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        placeholder="value…"
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-zinc-200 rounded px-2 py-1 w-24 focus:outline-none focus:border-zinc-400 bg-white"
      />
      <button
        type="button"
        title="Switch to field drop"
        onClick={onSwitchToField}
        className="text-xs text-zinc-400 hover:text-zinc-700 px-1 leading-none"
      >
        ⊞
      </button>
    </div>
  )
}

// --- RightSlot ---

interface RightSlotProps {
  conditionId: string
  value: FieldRef | LiteralValue
  onChange: (value: FieldRef | LiteralValue) => void
}

function RightSlot({ conditionId, value, onChange }: RightSlotProps) {
  const [mode, setMode] = useState<'field' | 'literal'>(() =>
    isFieldRef(value) ? 'field' : 'literal'
  )
  const [literalText, setLiteralText] = useState<string>(() =>
    isFieldRef(value) ? '' : String(value)
  )
  const slotId = `condition:${conditionId}:right`

  useEffect(() => {
    if (isFieldRef(value)) {
      setMode('field')
    } else {
      setMode('literal')
      setLiteralText(String(value))
    }
  }, [value])

  const switchToLiteral = () => {
    setLiteralText('')
    setMode('literal')
    // do NOT call onChange here — wait for the user to type
  }

  const switchToField = () => {
    setMode('field')
    onChange(EMPTY_FIELD_REF)
  }

  if (mode === 'literal') {
    return (
      <LiteralInput
        value={literalText}
        onChange={(raw) => {
          setLiteralText(raw)
          const numVal = Number(raw)
          onChange(raw !== '' && !isNaN(numVal) ? numVal : raw)
        }}
        onSwitchToField={switchToField}
      />
    )
  }

  const currentValue = isFieldRef(value) && value.tableId ? value : null
  return (
    <div className="flex items-center gap-1">
      <DropZone
        id={slotId}
        currentValue={currentValue}
        onDrop={(fieldRef) => onChange(fieldRef)}
        placeholder="Drop field"
      />
      <button
        type="button"
        title="Switch to literal value"
        onClick={switchToLiteral}
        className="text-xs text-zinc-400 hover:text-zinc-700 px-1 leading-none"
      >
        abc
      </button>
    </div>
  )
}

// --- ConditionRow ---

interface ConditionRowProps {
  condition: Condition
  index: number
  onUpdate: (updates: Partial<Omit<Condition, 'id'>>) => void
  onRemove: () => void
}

function ConditionRow({ condition, index, onUpdate, onRemove }: ConditionRowProps) {
  const leftSlotId = `condition:${condition.id}:left`
  const currentLeft = condition.left.tableId ? condition.left : null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-400 w-4 text-right shrink-0 select-none">
        {index + 1}
      </span>

      <DropZone
        id={leftSlotId}
        currentValue={currentLeft}
        onDrop={(fieldRef) => onUpdate({ left: fieldRef })}
        placeholder="Drop field"
      />

      <OperatorSelect
        value={condition.operator}
        onChange={(operator) => onUpdate({ operator })}
      />

      <RightSlot
        conditionId={condition.id}
        value={condition.right}
        onChange={(right) => onUpdate({ right })}
      />

      <button
        type="button"
        aria-label={`Remove condition ${index + 1}`}
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-500 text-base leading-none rounded hover:bg-zinc-100 shrink-0"
      >
        ×
      </button>
    </div>
  )
}

// --- ConditionPanel ---

export function ConditionPanel() {
  const { state, addCondition, removeCondition, updateCondition } = useBuilderStore()

  const handleAdd = () => {
    addCondition({
      id: crypto.randomUUID(),
      left: { ...EMPTY_FIELD_REF },
      operator: 'equal',
      right: { ...EMPTY_FIELD_REF },
    })
  }

  return (
    <section aria-labelledby="condition-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span id="condition-panel-heading" className="text-sm font-medium text-zinc-700">
          Condition
        </span>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Add condition"
          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1 transition-colors"
        >
          +
        </button>
      </div>

      {state.conditions.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No conditions yet —{' '}
          <button type="button" onClick={handleAdd} className="underline hover:text-zinc-700">
            add your first condition
          </button>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {state.conditions.map((condition, index) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              index={index}
              onUpdate={(updates) => updateCondition(condition.id, updates)}
              onRemove={() => removeCondition(condition.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
