import { z } from 'zod'

// --- Primitive schemas ---

export const FieldDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataType: z.enum(['number', 'string', 'boolean']),
})

export const TableSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['table', 'custom']),
  fields: z.array(FieldDefSchema),
})

export const FieldRefSchema = z.object({
  tableId: z.string(),
  fieldId: z.string(),
  label: z.string(), // "TableName.FieldName" — computed on creation
})

export const LiteralValueSchema = z.union([z.string(), z.number(), z.boolean()])

export const OperatorSchema = z.enum([
  'equal',
  'greater_than',
  'less_than',
  'not_equal',
  'contains',
])

export const ConditionSchema = z.object({
  id: z.string(),
  left: FieldRefSchema,
  operator: OperatorSchema,
  right: z.union([FieldRefSchema, LiteralValueSchema]),
})

// --- FormulaNode — recursive AST via z.lazy() ---

export type FormulaNode =
  | { type: 'field'; ref: z.infer<typeof FieldRefSchema> }
  | { type: 'literal'; value: z.infer<typeof LiteralValueSchema> }
  | { type: 'operation'; op: '+' | '-' | '*' | '/' | '%'; left: FormulaNode; right: FormulaNode }
  | { type: 'percent'; node: FormulaNode }

export const FormulaNodeSchema: z.ZodType<FormulaNode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('field'), ref: FieldRefSchema }),
    z.object({ type: z.literal('literal'), value: LiteralValueSchema }),
    z.object({
      type: z.literal('operation'),
      op: z.enum(['+', '-', '*', '/', '%']),
      left: FormulaNodeSchema,
      right: FormulaNodeSchema,
    }),
    z.object({ type: z.literal('percent'), node: FormulaNodeSchema }),
  ])
)

// --- Result & top-level state ---

export const ResultFormulaSchema = z.object({
  id: z.string(),
  name: z.string(),
  expression: FormulaNodeSchema,
})

export const BuilderStateSchema = z.object({
  tables: z.array(TableSourceSchema),
  conditions: z.array(ConditionSchema),
  results: z.array(ResultFormulaSchema),
})

// --- Parse helpers ---

/** Parse raw DB Json output (Prisma returns Json as unknown) into typed BuilderState */
export function parseBuilderState(raw: unknown): z.infer<typeof BuilderStateSchema> {
  return BuilderStateSchema.parse(raw)
}
