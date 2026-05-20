import { router } from '@/server/trpc'
import { formulaRouter } from '@/server/routers/formula'

export const appRouter = router({
  formula: formulaRouter,
})

export type AppRouter = typeof appRouter
