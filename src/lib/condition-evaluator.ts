import type { Condition, FieldRef } from '@/types'
import { toNumber, type DataContext } from '@/lib/formula-engine'

function isFieldRef(val: unknown): val is FieldRef {
  return typeof val === 'object' && val !== null && 'tableId' in val && 'fieldId' in val
}

function resolve(side: Condition['left'] | Condition['right'], ctx: DataContext): number | string {
  if (isFieldRef(side)) {
    const val = ctx[side.tableId]?.[side.fieldId]
    if (val === undefined) throw new Error(`Field not found: ${side.label || side.fieldId}`)
    return val
  }
  return side as number | string
}

export function evaluateCondition(cond: Condition, ctx: DataContext): boolean {
  const l = resolve(cond.left, ctx)
  const r = resolve(cond.right, ctx)
  switch (cond.operator) {
    case 'equal':        return l === r
    case 'not_equal':    return l !== r
    case 'greater_than': return toNumber(l, 'left operand') > toNumber(r, 'right operand')
    case 'less_than':    return toNumber(l, 'left operand') < toNumber(r, 'right operand')
    case 'contains':     return String(l).includes(String(r))
  }
}
