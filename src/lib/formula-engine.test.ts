import { describe, it, expect } from 'vitest'
import { evaluateFormula, toNumber, type DataContext } from '@/lib/formula-engine'
import type { FormulaNode } from '@/types'

const ctx: DataContext = {
  t1: { f1: 10, f2: 5, f3: 'hello' },
  t2: { f1: 3, f2: 0 },
}

// --- toNumber ---

describe('toNumber', () => {
  it('returns number as-is', () => {
    expect(toNumber(42, 'x')).toBe(42)
  })

  it('coerces numeric string', () => {
    expect(toNumber('3.14', 'x')).toBeCloseTo(3.14)
  })

  it('throws on non-numeric string', () => {
    expect(() => toNumber('abc', 'field')).toThrow('field is not a number: "abc"')
  })
})

// --- literal ---

describe('evaluateFormula — literal', () => {
  it('returns number literal', () => {
    const node: FormulaNode = { type: 'literal', value: 7 }
    expect(evaluateFormula(node, ctx)).toBe(7)
  })

  it('returns string literal', () => {
    const node: FormulaNode = { type: 'literal', value: 'world' }
    expect(evaluateFormula(node, ctx)).toBe('world')
  })
})

// --- field ---

describe('evaluateFormula — field', () => {
  it('resolves existing field', () => {
    const node: FormulaNode = { type: 'field', ref: { tableId: 't1', fieldId: 'f1', label: 't1.f1' } }
    expect(evaluateFormula(node, ctx)).toBe(10)
  })

  it('resolves string field', () => {
    const node: FormulaNode = { type: 'field', ref: { tableId: 't1', fieldId: 'f3', label: 't1.f3' } }
    expect(evaluateFormula(node, ctx)).toBe('hello')
  })

  it('throws when field missing', () => {
    const node: FormulaNode = { type: 'field', ref: { tableId: 't1', fieldId: 'missing', label: 'missing' } }
    expect(() => evaluateFormula(node, ctx)).toThrow('Field not found: missing')
  })

  it('throws when table missing', () => {
    const node: FormulaNode = { type: 'field', ref: { tableId: 'noTable', fieldId: 'f1', label: 'noTable.f1' } }
    expect(() => evaluateFormula(node, ctx)).toThrow('Field not found: noTable.f1')
  })
})

// --- percent ---

describe('evaluateFormula — percent', () => {
  it('divides value by 100', () => {
    const node: FormulaNode = { type: 'percent', node: { type: 'literal', value: 50 } }
    expect(evaluateFormula(node, ctx)).toBe(0.5)
  })

  it('wraps field value', () => {
    // t1.f1 = 10 → 10 / 100 = 0.1
    const node: FormulaNode = {
      type: 'percent',
      node: { type: 'field', ref: { tableId: 't1', fieldId: 'f1', label: 't1.f1' } },
    }
    expect(evaluateFormula(node, ctx)).toBe(0.1)
  })

  it('throws on string node', () => {
    const node: FormulaNode = {
      type: 'percent',
      node: { type: 'field', ref: { tableId: 't1', fieldId: 'f3', label: 't1.f3' } },
    }
    expect(() => evaluateFormula(node, ctx)).toThrow('is not a number')
  })
})

// --- operation ---

describe('evaluateFormula — operation', () => {
  const num = (v: number): FormulaNode => ({ type: 'literal', value: v })

  it('adds', () => {
    expect(evaluateFormula({ type: 'operation', op: '+', left: num(3), right: num(4) }, ctx)).toBe(7)
  })

  it('subtracts', () => {
    expect(evaluateFormula({ type: 'operation', op: '-', left: num(10), right: num(3) }, ctx)).toBe(7)
  })

  it('multiplies', () => {
    expect(evaluateFormula({ type: 'operation', op: '*', left: num(3), right: num(4) }, ctx)).toBe(12)
  })

  it('divides', () => {
    expect(evaluateFormula({ type: 'operation', op: '/', left: num(10), right: num(4) }, ctx)).toBe(2.5)
  })

  it('modulo', () => {
    expect(evaluateFormula({ type: 'operation', op: '%', left: num(10), right: num(3) }, ctx)).toBe(1)
  })

  it('throws on division by zero', () => {
    expect(() =>
      evaluateFormula({ type: 'operation', op: '/', left: num(5), right: num(0) }, ctx),
    ).toThrow('Division by zero')
  })

  it('throws on modulo by zero', () => {
    expect(() =>
      evaluateFormula({ type: 'operation', op: '%', left: num(5), right: num(0) }, ctx),
    ).toThrow('Modulo by zero')
  })

  it('resolves fields within operation', () => {
    // t1.f1(10) + t2.f1(3) = 13
    const node: FormulaNode = {
      type: 'operation',
      op: '+',
      left: { type: 'field', ref: { tableId: 't1', fieldId: 'f1', label: 't1.f1' } },
      right: { type: 'field', ref: { tableId: 't2', fieldId: 'f1', label: 't2.f1' } },
    }
    expect(evaluateFormula(node, ctx)).toBe(13)
  })
})

// --- nested ---

describe('evaluateFormula — nested operations', () => {
  it('evaluates (a + b) * c', () => {
    const node: FormulaNode = {
      type: 'operation',
      op: '*',
      left: {
        type: 'operation',
        op: '+',
        left: { type: 'literal', value: 2 },
        right: { type: 'literal', value: 3 },
      },
      right: { type: 'literal', value: 4 },
    }
    expect(evaluateFormula(node, ctx)).toBe(20)
  })

  it('evaluates field * percent(50)', () => {
    // t1.f1(10) * 50% = 10 * 0.5 = 5
    const node: FormulaNode = {
      type: 'operation',
      op: '*',
      left: { type: 'field', ref: { tableId: 't1', fieldId: 'f1', label: 't1.f1' } },
      right: { type: 'percent', node: { type: 'literal', value: 50 } },
    }
    expect(evaluateFormula(node, ctx)).toBe(5)
  })
})
