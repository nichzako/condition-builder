import type { FormulaNode, FieldRef } from '@/types'

export type DataContext = Record<string, Record<string, number | string>>

export function toNumber(val: number | string, hint: string): number {
  if (typeof val === 'number') return val
  const n = Number(val)
  if (Number.isNaN(n)) throw new Error(`${hint} is not a number: "${val}"`)
  return n
}

function resolveField(ref: FieldRef, ctx: DataContext): number | string {
  const val = ctx[ref.tableId]?.[ref.fieldId]
  if (val === undefined) throw new Error(`Field not found: ${ref.label || ref.fieldId}`)
  return val
}

export function evaluateFormula(node: FormulaNode, ctx: DataContext): number | string {
  switch (node.type) {
    case 'literal':
      return node.value
    case 'field':
      return resolveField(node.ref, ctx)
    case 'percent':
      return toNumber(evaluateFormula(node.node, ctx), 'percent') / 100
    case 'operation': {
      const l = toNumber(evaluateFormula(node.left, ctx), 'left operand')
      const r = toNumber(evaluateFormula(node.right, ctx), 'right operand')
      switch (node.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/':
          if (r === 0) throw new Error('Division by zero')
          return l / r
        case '%':
          if (r === 0) throw new Error('Modulo by zero')
          return l % r
        default: {
          const exhausted: never = node.op
          throw new Error(`Unknown operator: ${exhausted}`)
        }
      }
    }
  }
}
