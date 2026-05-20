import type { z } from 'zod'
import type {
  FieldDefSchema,
  TableSourceSchema,
  FieldRefSchema,
  LiteralValueSchema,
  OperatorSchema,
  ConditionSchema,
  ResultFormulaSchema,
  BuilderStateSchema,
} from '@/lib/schema'

export type { FormulaNode } from '@/lib/schema'

export type FieldDef = z.infer<typeof FieldDefSchema>
export type TableSource = z.infer<typeof TableSourceSchema>
export type FieldRef = z.infer<typeof FieldRefSchema>
export type LiteralValue = z.infer<typeof LiteralValueSchema>
export type Operator = z.infer<typeof OperatorSchema>
export type Condition = z.infer<typeof ConditionSchema>
export type ResultFormula = z.infer<typeof ResultFormulaSchema>
export type BuilderState = z.infer<typeof BuilderStateSchema>
