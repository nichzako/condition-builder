import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { publicProcedure, router } from '@/server/trpc'
import { db } from '@/server/db'
import {
  BuilderStateSchema,
  TableSourceSchema,
  ConditionSchema,
  ResultFormulaSchema,
  safeParseBuilderState,
} from '@/lib/schema'

function requireState(raw: unknown) {
  const state = safeParseBuilderState(raw)
  if (!state) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Formula state is corrupt',
    })
  }
  return state
}

// Re-validate updated state through BuilderStateSchema to enforce .max() limits (WR-03)
function requireValidState(updated: z.infer<typeof BuilderStateSchema>) {
  const result = safeParseBuilderState(updated)
  if (!result) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Operation would exceed builder limits',
    })
  }
  return result
}

export const formulaRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const formula = await db.formula.findUnique({ where: { id: input.id } })
      if (!formula) return null
      return {
        id: formula.id,
        name: formula.name,
        state: requireState(formula.state),
        updatedAt: formula.updatedAt,
      }
    }),

  // WR-01 fix: wrap entire update branch in $transaction
  upsert: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        state: BuilderStateSchema,
      }),
    )
    .mutation(async ({ input }) => {
      if (input.id) {
        return db.$transaction(async (tx) => {
          const existing = await tx.formula.findUnique({ where: { id: input.id } })
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
          }
          return tx.formula.update({
            where: { id: input.id },
            data: {
              ...(input.name !== undefined && { name: input.name }),
              state: input.state,
            },
          })
        })
      }
      return db.formula.create({
        data: { name: input.name ?? 'Untitled', state: input.state },
      })
    }),

  addTable: publicProcedure
    .input(z.object({ id: z.string(), table: TableSourceSchema }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = requireValidState({ ...state, tables: [...state.tables, input.table] })
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),

  removeTable: publicProcedure
    .input(z.object({ id: z.string(), tableId: z.string() }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = { ...state, tables: state.tables.filter((t) => t.id !== input.tableId) }
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),

  addCondition: publicProcedure
    .input(z.object({ id: z.string(), condition: ConditionSchema }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = requireValidState({
          ...state,
          conditions: [...state.conditions, input.condition],
        })
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),

  removeCondition: publicProcedure
    .input(z.object({ id: z.string(), conditionId: z.string() }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = {
          ...state,
          conditions: state.conditions.filter((c) => c.id !== input.conditionId),
        }
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),

  addResult: publicProcedure
    .input(z.object({ id: z.string(), result: ResultFormulaSchema }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = requireValidState({ ...state, results: [...state.results, input.result] })
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),

  removeResult: publicProcedure
    .input(z.object({ id: z.string(), resultId: z.string() }))
    .mutation(async ({ input }) =>
      db.$transaction(async (tx) => {
        const formula = await tx.formula.findUnique({ where: { id: input.id } })
        if (!formula) throw new TRPCError({ code: 'NOT_FOUND', message: 'Formula not found' })
        const state = requireState(formula.state)
        const updated = {
          ...state,
          results: state.results.filter((r) => r.id !== input.resultId),
        }
        return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
      }),
    ),
})
