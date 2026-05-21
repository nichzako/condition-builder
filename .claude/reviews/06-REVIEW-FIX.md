---
phase: 06-condition-panel
fixed_at: 2026-05-21T00:00:00Z
review_path: .claude/reviews/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-05-21
**Source review:** .claude/reviews/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `RightSlot` local state diverges from `value` prop after external updates

**Files modified:** `src/components/builder/ConditionPanel.tsx`
**Commit:** 6d7a43f
**Applied fix:** Refactored `RightSlot` to be a fully controlled component. `mode` is now derived directly from `value` on every render (`isFieldRef(value) ? 'field' : 'literal'`) — no local state for mode. `literalText` is also derived from `value` on each render. This eliminates all state-synchronisation drift: external updates (undo, DB reset) are automatically reflected because both values recompute from the prop every render. Note: an intermediate commit (`35154e8`) attempted a `useEffect`-based fix that was rejected by the project's `react-hooks/set-state-in-effect` lint rule, and a ref-during-render approach that was rejected by `react-hooks/refs`. The fully-controlled redesign is the lint-clean solution.

---

### WR-02: `boolean` literal value rendered as empty string

**Files modified:** `src/lib/schema.ts`, `src/components/builder/ConditionPanel.tsx`
**Commit:** 0da2382 (schema), 6d7a43f (props alignment)
**Applied fix:** Changed `ConditionSchema.right` from `z.union([FieldRefSchema, LiteralValueSchema])` to `z.union([FieldRefSchema, z.string(), z.number()])`, excluding `boolean` from the condition right-hand side. Updated `RightSlotProps` to use `FieldRef | string | number` instead of `FieldRef | LiteralValue` so TypeScript types stay consistent with the narrowed schema.

---

### WR-03: `e.target.value as Operator` cast without runtime validation

**Files modified:** `src/components/builder/ConditionPanel.tsx`
**Commit:** 36863d3
**Applied fix:** Added `import { OperatorSchema } from '@/lib/schema'` and replaced `onChange(e.target.value as Operator)` with a `safeParse` guard:
```ts
const result = OperatorSchema.safeParse(e.target.value)
if (result.success) onChange(result.data)
```

---

### IN-01: `EMPTY_FIELD_REF` object spread on every `handleAdd` call is unnecessary

**Files modified:** `src/components/builder/ConditionPanel.tsx`
**Commit:** 88c97f2
**Applied fix:** Removed `{ ...EMPTY_FIELD_REF }` spreads in `handleAdd`, replaced with direct references to `EMPTY_FIELD_REF`. The Zustand updater already spreads on update, so no mutation risk exists.

---

### IN-02: `switchToLiteral` reads stale `literalText` after a field-mode session

**Files modified:** `src/components/builder/ConditionPanel.tsx`
**Commit:** 6d7a43f
**Applied fix:** As part of the WR-01 fully-controlled refactor, `switchToLiteral` now calls `onChange('')` to write an empty string into the store — this drives `value` to `''` on the next render, which flips `mode` to `'literal'` automatically. No premature `onChange` with stale text. No local `literalText` state at all.

---

_Fixed: 2026-05-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
