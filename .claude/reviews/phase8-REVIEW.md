---
phase: phase8
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/formula-engine.ts
  - src/lib/condition-evaluator.ts
  - src/server/routers/formula.ts
  - src/components/builder/PreviewBox.tsx
  - src/components/builder/BuilderShell.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 8 adds a pure formula/condition evaluation layer (`formula-engine.ts`, `condition-evaluator.ts`), a new `evaluate` mutation in the tRPC `formulaRouter`, and a fully rewritten `PreviewBox` with mock data editing wired into `BuilderShell`. The architecture is sound — AST evaluation is pure and testable, the tRPC mutation is stateless and free of DB calls, and state flow from shell → preview is clean.

No critical issues were found. Four warnings concern logic correctness: an incomplete `switch` exhaustion in the formula engine, a type coercion gap in the condition evaluator, a stale-context problem in `BuilderShell`, and unsafe `Number()` coercions in `condition-evaluator.ts`. Three info items cover unused imports, dead code paths, and a minor naming suggestion.

---

## Warnings

### WR-01: `evaluateFormula` `operation` case has no exhaustive fallback — TypeScript does not catch the missing return

**File:** `src/lib/formula-engine.ts:26-40`
**Issue:** The outer `switch (node.type)` has a `case 'operation'` block that contains an inner `switch (node.op)`. The inner switch covers all five operators defined in `FormulaOpSchema`, but TypeScript infers the return type of the inner switch as `number` only when it is exhaustive. Because the outer `case 'operation'` block has no explicit `return` after the inner switch, TypeScript widens the outer function's return to `number | string | undefined`. The current type for `FormulaNode` is a discriminated union and `op` is typed `'+' | '-' | '*' | '/' | '%'`, so at runtime no code path can produce `undefined` — but the missing `default` means that if the schema ever gains a new operator (e.g., `**`), the function silently returns `undefined` instead of throwing, causing formula results to propagate `NaN` upstream without a clear error message.

**Fix:**
```typescript
case 'operation': {
  const l = toNumber(evaluateFormula(node.left, ctx), 'left operand')
  const r = toNumber(evaluateFormula(node.right, ctx), 'right operand')
  switch (node.op) {
    case '+': return l + r
    case '-': return l - r
    case '*': return l * r
    case '/':
      if (r === 0) throw new Error('Division by zero')
      return l / r
    case '%':
      if (r === 0) throw new Error('Modulo by zero')
      return l % r
    default: {
      const _exhaustive: never = node.op
      throw new Error(`Unsupported operator: ${_exhaustive}`)
    }
  }
}
```

---

### WR-02: `evaluateCondition` uses `Number()` coercion on `greater_than` / `less_than` — silently returns `false` for non-numeric strings

**File:** `src/lib/condition-evaluator.ts:23-24`
**Issue:** For `greater_than` and `less_than`, the evaluator calls `Number(l) > Number(r)`. If either side resolves to a non-numeric string (e.g., a `string`-typed field with value `"hello"`), `Number("hello")` produces `NaN`. Any comparison involving `NaN` returns `false` — no error is thrown, and the condition silently fails. This is especially misleading when the left field resolves correctly but the right side (a literal string) is coerced to `NaN`. The evaluator has no awareness of whether the values are expected to be numeric.

**Fix:** Throw an explicit error when a coercion yields `NaN`, consistent with `toNumber()` in `formula-engine.ts`:
```typescript
function toNumericOrThrow(val: number | string, hint: string): number {
  if (typeof val === 'number') return val
  const n = Number(val)
  if (Number.isNaN(n)) throw new Error(`${hint} is not a number for numeric comparison: "${val}"`)
  return n
}

// In evaluateCondition:
case 'greater_than': return toNumericOrThrow(l, 'left') > toNumericOrThrow(r, 'right')
case 'less_than':    return toNumericOrThrow(l, 'left') < toNumericOrThrow(r, 'right')
```

The `evaluate` mutation's per-condition try/catch will surface these errors in `PreviewBox` rather than silently showing `✗`.

---

### WR-03: `BuilderShell` passes `mockOverrides` as the `onContextChange` callback — removes all previously-set overrides for other tables on each field edit

**File:** `src/components/builder/BuilderShell.tsx:63` and `src/components/builder/PreviewBox.tsx:71-74`
**Issue:** `setMockOverrides` is passed directly as `onContextChange`. Inside `MockDataEditor.handleChange`, the new context is constructed as:
```typescript
onContextChange({
  ...mockContext,          // derived value (contains ALL tables + defaults)
  [tableId]: { ...mockContext[tableId], [fieldId]: parseValue(raw) },
})
```
`mockContext` is the *derived* context produced by `buildDefaultContext` (merged defaults + overrides), not the raw overrides. When this merged value is written back into `mockOverrides`, all default-filled entries become overrides. This is functionally mostly harmless today because defaults are stable, but it means every edit causes the full merged state to be stored as overrides, so `buildDefaultContext`'s "preserve previous value" logic in `BuilderShell` (`prev !== undefined`) will always find every field in overrides, even newly-added fields. More concretely: after one edit to Table 1 Field 1, a newly-added field that should receive a fresh default will instead inherit the old merged value.

**Fix:** Pass a stable callback that merges into overrides only, not the derived `mockContext`:
```typescript
// In BuilderShell:
const handleContextChange = useCallback(
  (tableId: string, fieldId: string, raw: string) => {
    setMockOverrides((prev) => ({
      ...prev,
      [tableId]: { ...prev[tableId], [fieldId]: parseValue(raw) },
    }))
  },
  [],
)
```
Then update `MockDataEditor` to accept `onFieldChange: (tableId: string, fieldId: string, raw: string) => void` instead of `onContextChange`, and have `BuilderShell` compute `parseValue` on the shell side (or keep it in `MockDataEditor` — either works as long as the override store only receives deltas, not the full merged context).

---

### WR-04: `formula.ts` router — unused imports from `@/lib/schema` increase bundle surface and may hide schema drift

**File:** `src/server/routers/formula.ts:6-11`
**Issue:** The `evaluate` mutation (new in Phase 8) does not use `TableSourceSchema`, `ConditionSchema`, or `ResultFormulaSchema` directly — they are already embedded inside `BuilderStateSchema`. These three named imports are also used by other mutations in the same file (`addTable`, `addCondition`, `addResult`), so they are not truly unused. However, the `safeParseBuilderState` import is used only inside `requireState`, while the `BuilderStateSchema` import is used only inside `requireValidState`. If future refactoring extracts `requireState` / `requireValidState` to a shared helper, these would become dangling. This is a low-severity concern today but worth noting.

The real issue is that `requireValidState` accepts `z.infer<typeof BuilderStateSchema>` — a fully-typed object — and then re-parses it through `safeParseBuilderState`. This is a redundant parse: an already-typed value cannot fail schema validation unless `.superRefine` rejects it (depth check on `ResultFormula`). The intent is documented in the comment, but the function signature implies it accepts already-valid data, which is misleading. Callers in `addTable` and `addCondition` never add a new `ResultFormula`, so the depth check never triggers — the re-parse is always a no-op for those mutations.

**Fix:** Rename to clarify intent, and only call it where a new `ResultFormula` is being added:
```typescript
// Rename to make the purpose clear
function enforceFormulaDepthLimit(updated: z.infer<typeof BuilderStateSchema>) {
  const result = safeParseBuilderState(updated)
  if (!result) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Operation would exceed builder limits' })
  }
  return result
}
// Only call in addResult, not addTable / addCondition
```

---

## Info

### IN-01: `formula-engine.ts` — `toNumber` is private but could be shared with `condition-evaluator.ts`

**File:** `src/lib/formula-engine.ts:5-9`
**Issue:** `condition-evaluator.ts` reimplements the same numeric coercion logic needed for `greater_than` / `less_than` (see WR-02). If the fix for WR-02 is applied, `toNumber` from `formula-engine.ts` should be exported and reused rather than duplicated.

**Fix:** Export `toNumber` from `formula-engine.ts`:
```typescript
export function toNumber(val: number | string, hint: string): number { ... }
```
Then import it in `condition-evaluator.ts`:
```typescript
import { toNumber, type DataContext } from '@/lib/formula-engine'
```

---

### IN-02: `BuilderShell.tsx` — `buildDefaultContext` uses array index (`ti`, `fi`) for default numeric values

**File:** `src/components/builder/BuilderShell.tsx:28-29`
**Issue:** Default numeric values are computed as `ti * 10 + fi + 1` (e.g., Table 0 Field 0 = 1, Table 1 Field 0 = 11). This is arbitrary and will produce values like 11, 12, 21 for a two-table setup, which is not intuitive for users reading the mock data editor. When fields are reordered or tables reordered, defaults change for unchanged fields. This is not a bug (saved overrides are preserved), but it can confuse users who haven't yet edited mock values.

**Fix:** Use `1` as a universal numeric default, or `0`, for predictable and user-readable initial values:
```typescript
prev !== undefined ? prev : field.dataType === 'string' ? `sample_${fi + 1}` : 1
```

---

### IN-03: `PreviewBox.tsx` — `formatValue` produces trailing-zero-stripped `toFixed(4)` which may display `0.1` as `0.1` but `1/3` as `0.3333`

**File:** `src/components/builder/PreviewBox.tsx:53-56`
**Issue:** `toFixed(4).replace(/\.?0+$/, '')` is a reasonable heuristic but has two edge cases: (a) very small numbers like `0.00001` are rounded to `0` after 4 decimal places with no indication of truncation, and (b) numbers like `1.00005` display as `1` rather than `1.0001` due to floating-point representation. For a UI displaying formula results this is acceptable, but worth documenting as a known display limitation rather than presenting it as an exact value.

**Fix:** No code change required. Add a brief comment:
```typescript
// Trim trailing zeros up to 4 decimal places; very small/large values may round visually
return val.toFixed(4).replace(/\.?0+$/, '')
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
