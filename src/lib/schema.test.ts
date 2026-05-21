import { describe, it, expect } from 'vitest'
import {
  FieldDefSchema,
  TableSourceSchema,
  FieldRefSchema,
  ConditionSchema,
  FormulaNodeSchema,
  ResultFormulaSchema,
  BuilderStateSchema,
  parseBuilderState,
  safeParseBuilderState,
  BUILDER_LIMITS,
} from '@/lib/schema'

// --- FieldDefSchema ---

describe('FieldDefSchema', () => {
  it('parses a valid field def', () => {
    expect(FieldDefSchema.safeParse({ id: 'f1', name: 'Score', dataType: 'number' }).success).toBe(true)
  })

  it('rejects unknown dataType', () => {
    expect(FieldDefSchema.safeParse({ id: 'f1', name: 'Score', dataType: 'date' }).success).toBe(false)
  })

  it('rejects missing name', () => {
    expect(FieldDefSchema.safeParse({ id: 'f1', dataType: 'number' }).success).toBe(false)
  })

  it('rejects id exceeding STR_ID limit', () => {
    const longId = 'x'.repeat(BUILDER_LIMITS.STR_ID + 1)
    expect(FieldDefSchema.safeParse({ id: longId, name: 'Score', dataType: 'number' }).success).toBe(false)
  })

  it('rejects name exceeding STR_NAME limit', () => {
    const longName = 'x'.repeat(BUILDER_LIMITS.STR_NAME + 1)
    expect(FieldDefSchema.safeParse({ id: 'f1', name: longName, dataType: 'number' }).success).toBe(false)
  })
})

// --- TableSourceSchema ---

describe('TableSourceSchema', () => {
  const base = { id: 't1', name: 'Table 1', type: 'table', fields: [] }

  it('parses a valid table', () => {
    expect(TableSourceSchema.safeParse(base).success).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(TableSourceSchema.safeParse({ ...base, type: 'remote' }).success).toBe(false)
  })

  it('rejects table with too many fields', () => {
    const fields = Array.from({ length: BUILDER_LIMITS.FIELDS_PER_TABLE + 1 }, (_, i) => ({
      id: `f${i}`,
      name: `Field ${i}`,
      dataType: 'number',
    }))
    expect(TableSourceSchema.safeParse({ ...base, fields }).success).toBe(false)
  })
})

// --- FieldRefSchema ---

describe('FieldRefSchema', () => {
  it('parses valid ref', () => {
    expect(FieldRefSchema.safeParse({ tableId: 't1', fieldId: 'f1', label: 't1.f1' }).success).toBe(true)
  })
})

// --- ConditionSchema ---

describe('ConditionSchema', () => {
  const left = { tableId: 't1', fieldId: 'f1', label: 't1.f1' }

  it('parses field vs literal number', () => {
    expect(ConditionSchema.safeParse({ id: 'c1', left, operator: 'equal', right: 42 }).success).toBe(true)
  })

  it('parses field vs literal string', () => {
    expect(ConditionSchema.safeParse({ id: 'c1', left, operator: 'contains', right: 'hello' }).success).toBe(true)
  })

  it('parses field vs field', () => {
    const right = { tableId: 't2', fieldId: 'f1', label: 't2.f1' }
    expect(ConditionSchema.safeParse({ id: 'c1', left, operator: 'greater_than', right }).success).toBe(true)
  })

  it('rejects unknown operator', () => {
    expect(ConditionSchema.safeParse({ id: 'c1', left, operator: 'between', right: 5 }).success).toBe(false)
  })

  it('rejects literal as left side — left must always be a FieldRef', () => {
    expect(ConditionSchema.safeParse({ id: 'c1', left: 42, operator: 'equal', right: 42 }).success).toBe(false)
  })
})

// --- FormulaNodeSchema ---

describe('FormulaNodeSchema', () => {
  it('parses literal node', () => {
    expect(FormulaNodeSchema.safeParse({ type: 'literal', value: 10 }).success).toBe(true)
  })

  it('parses field node', () => {
    expect(
      FormulaNodeSchema.safeParse({
        type: 'field',
        ref: { tableId: 't1', fieldId: 'f1', label: 't1.f1' },
      }).success,
    ).toBe(true)
  })

  it('parses nested operation', () => {
    expect(
      FormulaNodeSchema.safeParse({
        type: 'operation',
        op: '+',
        left: { type: 'literal', value: 1 },
        right: { type: 'literal', value: 2 },
      }).success,
    ).toBe(true)
  })

  it('parses percent node', () => {
    expect(
      FormulaNodeSchema.safeParse({ type: 'percent', node: { type: 'literal', value: 50 } }).success,
    ).toBe(true)
  })

  it('rejects unknown node type', () => {
    expect(FormulaNodeSchema.safeParse({ type: 'sqrt', value: 9 }).success).toBe(false)
  })
})

// --- ResultFormulaSchema — depth guard ---

describe('ResultFormulaSchema depth guard', () => {
  function buildDeepNode(depth: number): object {
    if (depth === 0) return { type: 'literal', value: 1 }
    return { type: 'operation', op: '+', left: buildDeepNode(depth - 1), right: { type: 'literal', value: 0 } }
  }

  it('accepts tree within depth limit', () => {
    const result = ResultFormulaSchema.safeParse({
      id: 'r1',
      name: 'Result1',
      expression: buildDeepNode(BUILDER_LIMITS.FORMULA_DEPTH - 1),
    })
    expect(result.success).toBe(true)
  })

  it('rejects tree exceeding depth limit', () => {
    const result = ResultFormulaSchema.safeParse({
      id: 'r1',
      name: 'Result1',
      expression: buildDeepNode(BUILDER_LIMITS.FORMULA_DEPTH + 1),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1)
      expect(result.error.issues[0].message).toContain('maximum depth')
    }
  })
})

// --- BuilderStateSchema ---

describe('BuilderStateSchema', () => {
  const empty = { tables: [], conditions: [], results: [] }

  it('parses empty state', () => {
    expect(BuilderStateSchema.safeParse(empty).success).toBe(true)
  })

  it('rejects too many tables', () => {
    const tables = Array.from({ length: BUILDER_LIMITS.TABLES + 1 }, (_, i) => ({
      id: `t${i}`,
      name: `Table ${i}`,
      type: 'table',
      fields: [],
    }))
    expect(BuilderStateSchema.safeParse({ ...empty, tables }).success).toBe(false)
  })
})

// --- parse helpers ---

describe('parseBuilderState', () => {
  it('returns parsed state on valid input', () => {
    const state = parseBuilderState({ tables: [], conditions: [], results: [] })
    expect(state).toEqual({ tables: [], conditions: [], results: [] })
  })

  it('throws ZodError on invalid input', () => {
    expect(() => parseBuilderState({ tables: 'wrong' })).toThrow()
  })
})

describe('safeParseBuilderState', () => {
  it('returns state on valid input', () => {
    expect(safeParseBuilderState({ tables: [], conditions: [], results: [] })).not.toBeNull()
  })

  it('returns null on invalid input', () => {
    expect(safeParseBuilderState({ wrong: true })).toBeNull()
  })
})
