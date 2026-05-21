import { describe, it, expect } from 'vitest'
import { evaluateCondition } from '@/lib/condition-evaluator'
import type { Condition } from '@/types'
import type { DataContext } from '@/lib/formula-engine'

const ctx: DataContext = {
  t1: { score: 90, name: 'Alice' },
  t2: { score: 70, tag: 'pro-user' },
}

function cond(
  left: Condition['left'],
  operator: Condition['operator'],
  right: Condition['right'],
): Condition {
  return { id: 'c1', left, operator, right }
}

const fieldRef = (tableId: string, fieldId: string) => ({
  tableId,
  fieldId,
  label: `${tableId}.${fieldId}`,
})

// --- equal ---

describe('evaluateCondition — equal', () => {
  it('returns true when field equals literal', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'equal', 90), ctx)).toBe(true)
  })

  it('returns false when unequal', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'equal', 80), ctx)).toBe(false)
  })

  it('compares two fields', () => {
    const ctx2: DataContext = { t1: { a: 5 }, t2: { b: 5 } }
    expect(evaluateCondition(cond(fieldRef('t1', 'a'), 'equal', fieldRef('t2', 'b')), ctx2)).toBe(true)
  })

  it('returns false when string "90" strictly !== number 90', () => {
    const ctx2: DataContext = { t1: { score: '90' } }
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'equal', 90), ctx2)).toBe(false)
  })
})

// --- not_equal ---

describe('evaluateCondition — not_equal', () => {
  it('returns true when different', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'not_equal', 50), ctx)).toBe(true)
  })

  it('returns false when same', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'not_equal', 90), ctx)).toBe(false)
  })
})

// --- greater_than ---

describe('evaluateCondition — greater_than', () => {
  it('returns true when left > right', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'greater_than', 80), ctx)).toBe(true)
  })

  it('returns false when left <= right', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'greater_than', 90), ctx)).toBe(false)
  })

  it('compares two numeric fields', () => {
    // t1.score(90) > t2.score(70) → true
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'greater_than', fieldRef('t2', 'score')), ctx)).toBe(true)
  })
})

// --- less_than ---

describe('evaluateCondition — less_than', () => {
  it('returns true when left < right', () => {
    expect(evaluateCondition(cond(fieldRef('t2', 'score'), 'less_than', 80), ctx)).toBe(true)
  })

  it('returns false when left >= right', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'less_than', 90), ctx)).toBe(false)
  })
})

// --- contains ---

describe('evaluateCondition — contains', () => {
  it('returns true when string contains substring', () => {
    expect(evaluateCondition(cond(fieldRef('t2', 'tag'), 'contains', 'pro'), ctx)).toBe(true)
  })

  it('returns false when string does not contain substring', () => {
    expect(evaluateCondition(cond(fieldRef('t2', 'tag'), 'contains', 'admin'), ctx)).toBe(false)
  })

  it('coerces number to string for contains check', () => {
    expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'contains', '9'), ctx)).toBe(true)
  })

  it('contains with field reference on right side', () => {
    const ctx2: DataContext = { t1: { haystack: 'pro-user' }, t2: { needle: 'pro' } }
    expect(
      evaluateCondition(cond(fieldRef('t1', 'haystack'), 'contains', fieldRef('t2', 'needle')), ctx2),
    ).toBe(true)
  })
})

// --- error cases ---

describe('evaluateCondition — errors', () => {
  it('throws when field not in context', () => {
    expect(() =>
      evaluateCondition(cond(fieldRef('t1', 'missing'), 'equal', 0), ctx),
    ).toThrow('Field not found: t1.missing')
  })

  it('throws on non-numeric field for greater_than', () => {
    expect(() =>
      evaluateCondition(cond(fieldRef('t1', 'name'), 'greater_than', 0), ctx),
    ).toThrow('is not a number')
  })
})
