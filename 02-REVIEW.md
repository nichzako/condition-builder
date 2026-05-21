---
phase: 02-trpc-router
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/server/trpc.ts
  - src/server/root.ts
  - src/server/routers/formula.ts
  - src/app/api/trpc/[trpc]/route.ts
  - src/lib/trpc/client.ts
  - src/lib/trpc/provider.tsx
  - src/lib/schema.ts
  - prisma/schema.prisma
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 2 tRPC layer: server init, appRouter, formula router, HTTP route handler, client setup, TRPCProvider, Zod schemas, and Prisma schema.

The overall structure is solid — `$transaction` is used correctly for all read-modify-write mutations, `safeParseBuilderState` prevents ZodError leaks from the DB, superjson is wired consistently on both client and server, and error codes are appropriate. Three issues need attention before shipping:

1. The `upsert` mutation runs a check-then-update outside a transaction (TOCTOU race).
2. The recursive `FormulaNodeSchema` has no depth cap, which is a potential DoS vector against the Zod parser.
3. The `addTable` / `addCondition` / `addResult` mutations do not re-validate the updated array against the `BuilderStateSchema` max limits before writing, so the caps in the schema are only enforced on input validation and can be bypassed at the array-grow step.

---

## Warnings

### WR-01: `upsert` mutation — check-then-update outside a transaction (TOCTOU)

**File:** `src/server/routers/formula.ts:47-58`

**Issue:** The `upsert` mutation reads the record with `findUnique` (line 48) and then calls `formula.update` (line 52) as two separate, non-atomic operations. Under concurrent requests with the same `id`, a second caller can pass the existence check and then have its `update` overwrite the first caller's write — or, if the record is deleted between the two calls, Prisma throws an uncaught `PrismaClientKnownRequestError` (P2025) that is not mapped to a `TRPCError`, causing an unhandled 500.

**Fix:** Wrap the update branch in `$transaction`, or use Prisma's native `upsert` which is atomic:

```typescript
// Option A — use Prisma's built-in atomic upsert
upsert: publicProcedure
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().max(200).optional(),
      state: BuilderStateSchema,
    }),
  )
  .mutation(async ({ input }) => {
    if (input.id) {
      // Wrap in transaction so the NOT_FOUND check and update are atomic
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
```

---

### WR-02: Recursive `FormulaNodeSchema` has no depth limit — potential DoS via stack overflow

**File:** `src/lib/schema.ts:49-61`

**Issue:** `FormulaNodeSchema` is defined with `z.lazy()` and calls itself recursively with no maximum depth guard. Any `addResult` or `upsert` call that supplies a deeply-nested `expression` AST (e.g. `{ type: 'operation', left: { type: 'operation', left: … } }` repeated thousands of times) will cause Zod to recurse until the call stack is exhausted. In a serverless environment this crashes the function invocation; in a long-running server it is an unhandled exception.

**Fix:** Add a depth-aware wrapper that rejects payloads exceeding a reasonable limit before Zod walks the tree:

```typescript
// In schema.ts — add a depth check before parsing ResultFormula or BuilderState
const MAX_FORMULA_DEPTH = 20

function checkFormulaDepth(node: unknown, depth = 0): boolean {
  if (depth > MAX_FORMULA_DEPTH) return false
  if (typeof node !== 'object' || node === null) return true
  const n = node as Record<string, unknown>
  if (n.type === 'operation') {
    return (
      checkFormulaDepth(n.left, depth + 1) &&
      checkFormulaDepth(n.right, depth + 1)
    )
  }
  if (n.type === 'percent') {
    return checkFormulaDepth(n.node, depth + 1)
  }
  return true
}

export const ResultFormulaSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  expression: FormulaNodeSchema,
}).superRefine((val, ctx) => {
  if (!checkFormulaDepth(val.expression)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Formula expression exceeds maximum nesting depth of ${MAX_FORMULA_DEPTH}`,
      path: ['expression'],
    })
  }
})
```

---

### WR-03: `addTable` / `addCondition` / `addResult` do not enforce `BuilderStateSchema` max limits after mutation

**File:** `src/server/routers/formula.ts:72, 96, 123`

**Issue:** `BuilderStateSchema` declares `.max(50)` on `tables`, `.max(200)` on `conditions`, and `.max(50)` on `results`. These limits are enforced when the *input* is validated through `BuilderStateSchema` (e.g. in the `upsert` procedure). However, the granular `addTable` / `addCondition` / `addResult` mutations read the current state from the DB, push one item, and write back — without re-parsing the resulting object through `BuilderStateSchema`. A client that calls `addTable` 51 times will successfully persist 51 tables.

**Fix:** After constructing `updated`, parse it through `BuilderStateSchema` before the `tx.formula.update` call and convert a validation failure into a `TRPCError`:

```typescript
// Shared helper — add to formula.ts or a shared util
function validateUpdatedState(
  updated: unknown,
  formulaId: string,
): z.infer<typeof BuilderStateSchema> {
  const result = BuilderStateSchema.safeParse(updated)
  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: result.error.issues[0]?.message ?? 'State exceeds allowed limits',
    })
  }
  return result.data
}

// Inside addTable transaction:
const updated = validateUpdatedState(
  { ...state, tables: [...state.tables, input.table] },
  input.id,
)
return tx.formula.update({ where: { id: input.id }, data: { state: updated } })
```

Apply the same pattern in `addCondition` and `addResult`.

---

## Info

### IN-01: `requireState` error message includes `formulaId` — sent to client

**File:** `src/server/routers/formula.ts:16-18`

**Issue:** The `INTERNAL_SERVER_ERROR` message `"Formula ${formulaId} has corrupt state"` is logged by `onError` in `route.ts`, which is correct. However, tRPC also serialises the `message` field and sends it to the client in the error response. The `formulaId` value is a CUID and carries low sensitivity, but exposing internal state labels to clients is a minor information disclosure.

**Fix:** Use a generic client-facing message and keep detail server-side only:

```typescript
throw new TRPCError({
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Formula state is invalid. Please contact support.',
  cause: new Error(`Formula ${formulaId} has corrupt state`), // logged by onError
})
```

---

### IN-02: String fields in Zod schemas have no `max()` length constraints

**File:** `src/lib/schema.ts:6-16, 65-69`

**Issue:** `FieldDefSchema.name`, `TableSourceSchema.name`, `ResultFormulaSchema.name`, `FieldRefSchema.label`, and the `name` input in `upsert` are all `z.string()` with no upper bound. Excessively long strings will be stored in the DB without rejection. PostgreSQL `text` columns accept up to 1 GB, so this will not cause a DB error, but it allows unbounded writes.

**Fix:** Add `.max()` on name fields:

```typescript
export const FieldDefSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  dataType: z.enum(['number', 'string', 'boolean']),
})

export const TableSourceSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  type: z.enum(['table', 'custom']),
  fields: z.array(FieldDefSchema).max(100),
})
```

---

### IN-03: No authentication — all formula mutations are publicly accessible

**File:** `src/server/trpc.ts:8-9`

**Issue:** Only `publicProcedure` is exported. Any caller that knows (or guesses) a `formulaId` CUID can update, delete tables/conditions/results from, or overwrite any formula in the database. This is expected for a single-tenant demo, but if multi-user or shared deployment is in scope, a `protectedProcedure` with session/token verification will be needed before Phase 3 UI wires up save flows.

**Fix:** When authentication is introduced, add a `protectedProcedure` in `trpc.ts` and replace `publicProcedure` in `formula.ts` for write operations:

```typescript
// src/server/trpc.ts (future)
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})
```

---

### IN-04: `upsert` does not guard against duplicate `name` values

**File:** `src/server/routers/formula.ts:60-62`

**Issue:** `db.formula.create` on line 61 does not check for existing formulas with the same `name`. The Prisma schema has a `@@index([name])` for query performance but no `@unique` constraint. If UX intends names to be unique (the mockup shows "Untitled" as default), a uniqueness collision will silently create a duplicate rather than returning an error. This is a logic gap rather than a crash risk.

**Fix:** If names must be unique, add `@@unique([name])` to the Prisma model and handle the `P2002` unique constraint error in the mutation. If names are intentionally non-unique, remove the `@@index([name])` to avoid the misleading implication, or add a comment clarifying that duplicates are allowed.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
