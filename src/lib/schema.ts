import { z } from 'zod'

// --- Named limits (coding-standards: no magic numbers) ---

export const BUILDER_LIMITS = {
  TABLES: 50,
  CONDITIONS: 200,
  RESULTS: 50,
  FIELDS_PER_TABLE: 100,
  FORMULA_DEPTH: 20,
  STR_ID: 128,
  STR_NAME: 200,
  STR_LABEL: 255,
} as const

// --- Primitive schemas ---

export const FieldDefSchema = z.object({
  id: z.string().max(BUILDER_LIMITS.STR_ID),
  name: z.string().max(BUILDER_LIMITS.STR_NAME),
  dataType: z.enum(['number', 'string', 'boolean']),
})

export const TableSourceSchema = z.object({
  id: z.string().max(BUILDER_LIMITS.STR_ID),
  name: z.string().max(BUILDER_LIMITS.STR_NAME),
  type: z.enum(['table', 'custom']),
  fields: z.array(FieldDefSchema).max(BUILDER_LIMITS.FIELDS_PER_TABLE),
})

export const FieldRefSchema = z.object({
  tableId: z.string().max(BUILDER_LIMITS.STR_ID),
  fieldId: z.string().max(BUILDER_LIMITS.STR_ID),
  label: z.string().max(BUILDER_LIMITS.STR_LABEL),
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
  id: z.string().max(BUILDER_LIMITS.STR_ID),
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

// Depth guard for recursive AST — prevents stack overflow on crafted payloads (WR-02)
function isFormulaDepthOk(node: FormulaNode, depth: number): boolean {
  if (depth > BUILDER_LIMITS.FORMULA_DEPTH) return false
  if (node.type === 'operation') {
    return isFormulaDepthOk(node.left, depth + 1) && isFormulaDepthOk(node.right, depth + 1)
  }
  if (node.type === 'percent') {
    return isFormulaDepthOk(node.node, depth + 1)
  }
  return true
}

// --- Result & top-level state ---

export const ResultFormulaSchema = z
  .object({
    id: z.string().max(BUILDER_LIMITS.STR_ID),
    name: z.string().max(BUILDER_LIMITS.STR_NAME),
    expression: FormulaNodeSchema,
  })
  .superRefine((data, ctx) => {
    if (!isFormulaDepthOk(data.expression, 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formula tree exceeds maximum depth of ${BUILDER_LIMITS.FORMULA_DEPTH}`,
        path: ['expression'],
      })
    }
  })

export const BuilderStateSchema = z.object({
  tables: z.array(TableSourceSchema).max(BUILDER_LIMITS.TABLES),
  conditions: z.array(ConditionSchema).max(BUILDER_LIMITS.CONDITIONS),
  results: z.array(ResultFormulaSchema).max(BUILDER_LIMITS.RESULTS),
})

// --- Parse helpers ---

/** Parse raw DB Json output — throws ZodError on failure (use only in trusted contexts) */
export function parseBuilderState(raw: unknown): z.infer<typeof BuilderStateSchema> {
  return BuilderStateSchema.parse(raw)
}

/** Safe parse — returns null on failure instead of throwing */
export function safeParseBuilderState(
  raw: unknown,
): z.infer<typeof BuilderStateSchema> | null {
  const result = BuilderStateSchema.safeParse(raw)
  return result.success ? result.data : null
}
