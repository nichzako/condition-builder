---
phase: phase8
fixed: 2026-05-21T00:00:00Z
source_review: phase8-REVIEW.md
status: all_fixed
---

# Phase 8: Review Fix Summary

**Fixed:** 2026-05-21
**Source:** phase8-REVIEW.md
**TypeScript:** PASS (0 errors)

## Fixes Applied

### WR-04 — `requireValidState` renamed + scope narrowed
**File:** `src/server/routers/formula.ts`
- Renamed `requireValidState` → `enforceFormulaDepthLimit` to clarify intent
- Removed the call from `addTable` and `addCondition` (depth limit is irrelevant for non-formula mutations)
- Call retained only in `addResult` where recursive formula depth must be enforced

### IN-02 — Default numeric value simplified
**File:** `src/components/builder/BuilderShell.tsx`
- Changed `ti * 10 + fi + 1` → `1` for all numeric field defaults
- New fields now show `1` instead of arbitrary positional values like 11, 21

### IN-03 — `formatValue` comment added
**File:** `src/components/builder/PreviewBox.tsx`
- Added comment documenting the known display limitation of `toFixed(4)` rounding

### FD-1 — PreviewBox background separation
**File:** `src/components/builder/PreviewBox.tsx`
- Changed `bg-zinc-50` → `bg-white border-t border-zinc-200`
- PreviewBox now has a clear visual boundary from the builder panels above

### FD-2 — Results entrance animation
**File:** `src/components/builder/PreviewBox.tsx`
- Wrapped `runResult` block in `animate-in fade-in duration-200`
- Results fade in smoothly after RUN instead of snapping in

### FD-3 — SaveIndicator color transition
**File:** `src/components/builder/BuilderShell.tsx`
- Added `transition-colors duration-150` to SaveIndicator span
- Status color changes animate instead of switching abruptly

### FD-4 — ✓/✗ replaced with lucide-react icons
**File:** `src/components/builder/PreviewBox.tsx`
- Replaced raw Unicode `✓`/`✗` characters with `CheckCircle2` / `XCircle` at `size={13}`
- Consistent with shadcn/ui icon system already in the stack

### FD-5 — Empty states styled
**File:** `src/components/builder/PreviewBox.tsx`
- Added `border border-dashed border-zinc-200 rounded px-3 py-2` to all three empty states
- Affects: "No conditions", "No formulas", "Click RUN" messages

### Pattern — `handleRun` wrapped in `useCallback`
**File:** `src/components/builder/BuilderShell.tsx`
- Added `useCallback` import
- `handleRun` now stable across renders; deps: `[evaluate, state, mockContext]`

## Already Fixed (carried from previous session)

| ID | Description |
|----|-------------|
| WR-01 | `default: never` exhaustive guard in `formula-engine.ts` switch |
| WR-02 | `toNumber` from formula-engine used in condition-evaluator (throws on NaN) |
| WR-03 | Delta callback pattern in BuilderShell — overrides stored separately from derived context |
| IN-01 | `toNumber` exported from `formula-engine.ts` |
