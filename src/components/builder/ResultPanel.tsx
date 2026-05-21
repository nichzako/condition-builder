'use client'

import { useCallback } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { DropZone } from '@/components/dnd/DropZone'
import { BUILDER_LIMITS, FormulaOpSchema } from '@/lib/schema'
import type { FormulaNode, FieldRef, ResultFormula } from '@/types'

// --- Types & Constants ---

type NodePath = ('left' | 'right' | 'node')[]
type FormulaOp = '+' | '-' | '*' | '/' | '%'

const OPS: FormulaOp[] = ['+', '-', '*', '/', '%']
const OP_DISPLAY: Record<FormulaOp, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '%': 'mod',
}

const EMPTY_FIELD_REF: FieldRef = { tableId: '', fieldId: '', label: '' }

// UI depth cap — lower than schema's hard limit for usability; still derived from BUILDER_LIMITS
// so any future increase to FORMULA_DEPTH is automatically respected up to 8 levels.
const UI_MAX_DEPTH = Math.min(8, BUILDER_LIMITS.FORMULA_DEPTH)

const microBtn =
  'text-[10px] text-zinc-400 hover:text-zinc-600 px-1 border border-zinc-200 rounded leading-5'
const collapseBtn =
  'w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-red-500 text-xs rounded hover:bg-zinc-100'

// --- Tree utilities ---

function updateAtPath(root: FormulaNode, path: NodePath, next: FormulaNode): FormulaNode {
  if (path.length === 0) return next
  const [head, ...tail] = path
  if (root.type === 'operation' && (head === 'left' || head === 'right')) {
    return { ...root, [head]: updateAtPath(root[head], tail, next) }
  }
  if (root.type === 'percent' && head === 'node') {
    return { ...root, node: updateAtPath(root.node, tail, next) }
  }
  // Path/type mismatch — indicates a bug in path construction; no-op to prevent corruption
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[updateAtPath] path segment', head, 'does not match node type', root.type)
  }
  return root
}

function wrapInOperation(left: FormulaNode): FormulaNode {
  return { type: 'operation', op: '+', left, right: { type: 'field', ref: EMPTY_FIELD_REF } }
}

// --- Shared sub-editor props ---

interface BaseNodeProps {
  path: NodePath
  resultId: string
  onUpdate: (path: NodePath, next: FormulaNode) => void
  depth: number
}

// --- FieldNodeEditor ---

interface FieldNodeEditorProps extends BaseNodeProps {
  node: Extract<FormulaNode, { type: 'field' }>
}

function FieldNodeEditor({ node, path, resultId, onUpdate, depth }: FieldNodeEditorProps) {
  const dropId = `result:${resultId}:${path.join('.') || 'root'}`
  const current = node.ref.tableId ? node.ref : null
  const canExpand = depth < UI_MAX_DEPTH

  return (
    <span className="inline-flex items-center gap-1">
      <DropZone
        id={dropId}
        currentValue={current}
        onDrop={(ref) => onUpdate(path, { type: 'field', ref })}
        placeholder="Drop field"
      />
      <button
        type="button"
        aria-label="Switch to literal value"
        title="Switch to literal value"
        onClick={() => onUpdate(path, { type: 'literal', value: '' })}
        className={microBtn}
      >
        abc
      </button>
      {canExpand && (
        <>
          <button
            type="button"
            aria-label="Add operation"
            title="Add operation"
            onClick={() => onUpdate(path, wrapInOperation(node))}
            className={microBtn}
          >
            +op
          </button>
          <button
            type="button"
            aria-label="Wrap in percent"
            title="Wrap in percent"
            onClick={() => onUpdate(path, { type: 'percent', node })}
            className={microBtn}
          >
            %
          </button>
        </>
      )}
    </span>
  )
}

// --- LiteralNodeEditor ---

interface LiteralNodeEditorProps extends BaseNodeProps {
  node: Extract<FormulaNode, { type: 'literal' }>
}

function LiteralNodeEditor({ node, path, resultId: _resultId, onUpdate, depth }: LiteralNodeEditorProps) {
  const canExpand = depth < UI_MAX_DEPTH

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        value={String(node.value ?? '')}
        onChange={(e) => {
          const raw = e.target.value
          const n = Number(raw)
          onUpdate(path, { type: 'literal', value: raw !== '' && !isNaN(n) ? n : raw })
        }}
        placeholder="value…"
        aria-label="Literal value"
        className="text-xs border border-zinc-200 rounded px-2 py-1 w-20 bg-white focus:outline-none focus:border-zinc-400"
      />
      <button
        type="button"
        aria-label="Switch to field drop"
        title="Switch to field drop"
        onClick={() => onUpdate(path, { type: 'field', ref: EMPTY_FIELD_REF })}
        className={microBtn}
      >
        ⊞
      </button>
      {canExpand && (
        <button
          type="button"
          aria-label="Add operation"
          title="Add operation"
          onClick={() => onUpdate(path, wrapInOperation(node))}
          className={microBtn}
        >
          +op
        </button>
      )}
    </span>
  )
}

// --- OperationNodeEditor ---

interface OperationNodeEditorProps extends BaseNodeProps {
  node: Extract<FormulaNode, { type: 'operation' }>
}

function OperationNodeEditor({ node, path, resultId, onUpdate, depth }: OperationNodeEditorProps) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <NodeEditor
        node={node.left}
        path={[...path, 'left']}
        resultId={resultId}
        onUpdate={onUpdate}
        depth={depth + 1}
      />
      <select
        aria-label="Formula operator"
        value={node.op}
        onChange={(e) => {
          const result = FormulaOpSchema.safeParse(e.target.value)
          if (result.success) onUpdate(path, { ...node, op: result.data })
        }}
        className="text-xs border border-zinc-200 rounded px-1 py-1 bg-white text-zinc-700 focus:outline-none focus:border-zinc-400"
      >
        {OPS.map((op) => (
          <option key={op} value={op}>
            {OP_DISPLAY[op]}
          </option>
        ))}
      </select>
      <NodeEditor
        node={node.right}
        path={[...path, 'right']}
        resultId={resultId}
        onUpdate={onUpdate}
        depth={depth + 1}
      />
      <button
        type="button"
        aria-label="Collapse operation — keep left operand only"
        title="Collapse — keep left operand only"
        onClick={() => onUpdate(path, node.left)}
        className={collapseBtn}
      >
        ×
      </button>
    </span>
  )
}

// --- PercentNodeEditor ---

interface PercentNodeEditorProps extends BaseNodeProps {
  node: Extract<FormulaNode, { type: 'percent' }>
}

function PercentNodeEditor({ node, path, resultId, onUpdate, depth }: PercentNodeEditorProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <NodeEditor
        node={node.node}
        path={[...path, 'node']}
        resultId={resultId}
        onUpdate={onUpdate}
        depth={depth + 1}
      />
      <span className="text-xs text-zinc-500 px-1 border border-zinc-200 rounded bg-zinc-50">
        (%)
      </span>
      <button
        type="button"
        aria-label="Unwrap percent"
        title="Unwrap percent"
        onClick={() => onUpdate(path, node.node)}
        className={collapseBtn}
      >
        ×
      </button>
    </span>
  )
}

// --- NodeEditor — dispatcher ---

interface NodeEditorProps extends BaseNodeProps {
  node: FormulaNode
}

function NodeEditor({ node, ...rest }: NodeEditorProps) {
  if (node.type === 'field') return <FieldNodeEditor node={node} {...rest} />
  if (node.type === 'literal') return <LiteralNodeEditor node={node} {...rest} />
  if (node.type === 'operation') return <OperationNodeEditor node={node} {...rest} />
  return <PercentNodeEditor node={node} {...rest} />
}

// --- ResultRow ---

interface ResultRowProps {
  result: ResultFormula
  index: number
  onUpdate: (updates: Partial<Omit<ResultFormula, 'id'>>) => void
  onRemove: () => void
}

function ResultRow({ result, index, onUpdate, onRemove }: ResultRowProps) {
  const handleNodeUpdate = useCallback(
    (path: NodePath, next: FormulaNode) => {
      onUpdate({ expression: updateAtPath(result.expression, path, next) })
    },
    [result.expression, onUpdate],
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-400 w-4 text-right shrink-0 select-none">
        {index + 1}
      </span>
      <input
        type="text"
        value={result.name}
        onChange={(e) =>
          onUpdate({ name: e.target.value.trimStart().slice(0, BUILDER_LIMITS.STR_NAME) })
        }
        aria-label={`Result ${index + 1} name`}
        className="text-xs border border-zinc-200 rounded px-2 py-1 w-24 bg-white focus:outline-none focus:border-zinc-400 font-medium"
        placeholder="Name…"
      />
      <span className="text-xs text-zinc-400">→</span>
      <NodeEditor
        node={result.expression}
        path={[]}
        resultId={result.id}
        onUpdate={handleNodeUpdate}
        depth={0}
      />
      <button
        type="button"
        aria-label={`Remove result ${index + 1}`}
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-500 text-base leading-none rounded hover:bg-zinc-100 shrink-0"
      >
        ×
      </button>
    </div>
  )
}

// --- ResultPanel ---

export function ResultPanel() {
  const { state, addResult, removeResult, updateResult } = useBuilderStore()

  const handleAdd = () => {
    addResult({
      id: crypto.randomUUID(),
      name: `Result ${state.results.length + 1}`,
      expression: { type: 'field', ref: EMPTY_FIELD_REF },
    })
  }

  return (
    <section aria-labelledby="result-panel-heading" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 id="result-panel-heading" className="text-sm font-medium text-zinc-700">
          Result
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Add result"
          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1 transition-colors"
        >
          +
        </button>
      </div>

      {state.results.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No results yet —{' '}
          <button type="button" onClick={handleAdd} className="underline hover:text-zinc-700">
            add your first result
          </button>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {state.results.map((result, index) => (
            <ResultRow
              key={result.id}
              result={result}
              index={index}
              onUpdate={(updates) => updateResult(result.id, updates)}
              onRemove={() => removeResult(result.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
