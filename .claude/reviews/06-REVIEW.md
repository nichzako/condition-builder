---
phase: 06-condition-panel
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/builder/ConditionPanel.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`ConditionPanel.tsx` is a well-structured client component that cleanly decomposes into `OperatorSelect`, `LiteralInput`, `RightSlot`, and `ConditionRow`. The DnD integration via `DropZone` and the Zustand store wiring are straightforward and follow project conventions.

Three warning-level issues were found. The most impactful is a stale-closure / state-synchronisation bug in `RightSlot`: the component's `mode` and `literalText` state are derived from `value` only at mount time, so they go out of sync when the parent drives a value change after a drop. The other two warnings are a missing validation guard for the `boolean` literal branch that `LiteralValue` allows, and an `e.target.value as Operator` cast that bypasses TypeScript's safety without a runtime check.

No security vulnerabilities were found.

---

## Warnings

### WR-01: `RightSlot` local state diverges from `value` prop after external updates

**File:** `src/components/builder/ConditionPanel.tsx:86-88`

**Issue:** `mode` and `literalText` are initialised once from the incoming `value` prop:

```ts
const initialMode = isFieldRef(value) ? 'field' : 'literal'
const [mode, setMode] = useState<'field' | 'literal'>(initialMode)
const [literalText, setLiteralText] = useState<string>(isFieldRef(value) ? '' : String(value))
```

`useState` ignores the argument on every render after the first. If the parent resets or replaces the condition (e.g. undo, `setState` bulk-replace from the DB), `mode` stays at its original value and `literalText` stays at its original text. The UI will show stale content while the store holds the new value.

**Fix:** Derive display state from `value` via `useEffect` so the component re-syncs whenever the prop changes:

```ts
const [mode, setMode] = useState<'field' | 'literal'>(() =>
  isFieldRef(value) ? 'field' : 'literal'
)
const [literalText, setLiteralText] = useState<string>(() =>
  isFieldRef(value) ? '' : String(value)
)

useEffect(() => {
  if (isFieldRef(value)) {
    setMode('field')
  } else {
    setMode('literal')
    setLiteralText(String(value))
  }
}, [value])
```

---

### WR-02: `boolean` literal value rendered as empty string

**File:** `src/components/builder/ConditionPanel.tsx:88`

**Issue:** `LiteralValue` is `string | number | boolean` (from `LiteralValueSchema`). When `value` is `false`, `isFieldRef(value)` returns `false` and `String(false)` produces `"false"` — this part is fine — but a stored `false` would also match the falsy branch of `isFieldRef` without any boolean-specific handling. More importantly, `LiteralInput` always emits either a number or a plain string (lines 108-109); it can never produce or display a `boolean`. If the store ever holds a boolean (e.g. loaded from the DB), it renders correctly as the string `"false"` or `"true"`, but the first edit converts it silently to a string, losing the boolean type permanently. There is no input affordance or explicit handling path for booleans.

**Fix:** Either exclude `boolean` from what can appear in the right slot of a condition (restrict `LiteralValue` in `ConditionSchema.right` to `z.union([z.string(), z.number()])` for now), or add an explicit boolean toggle input branch in `RightSlot` so the round-trip is lossless.

The minimal safe fix is a schema-level restriction since boolean conditions are not exposed in the current UI anyway:

```ts
// schema.ts — scope right-side literals to string | number only
right: z.union([FieldRefSchema, z.string(), z.number()])
```

---

### WR-03: `e.target.value as Operator` cast without runtime validation

**File:** `src/components/builder/ConditionPanel.tsx:35`

```ts
onChange={(e) => onChange(e.target.value as Operator)}
```

**Issue:** `e.target.value` is `string`. The cast to `Operator` is only valid if the `<select>` options are exhaustive and in sync with the `Operator` union. They currently are (both derive from `OPERATORS`), but the cast silently breaks if a future developer adds a value to the HTML options without adding it to the union, or vice versa. TypeScript cannot catch this because the cast suppresses the error.

**Fix:** Add a one-line guard using the existing `OperatorSchema`:

```ts
import { OperatorSchema } from '@/lib/schema'

onChange={(e) => {
  const result = OperatorSchema.safeParse(e.target.value)
  if (result.success) onChange(result.data)
}}
```

This is zero-overhead at runtime (Zod enum parse on a known-small enum) and makes the validation explicit.

---

## Info

### IN-01: `EMPTY_FIELD_REF` object spread on every `handleAdd` call is unnecessary

**File:** `src/components/builder/ConditionPanel.tsx:193-196`

```ts
addCondition({
  id: crypto.randomUUID(),
  left: { ...EMPTY_FIELD_REF },
  operator: 'equal',
  right: { ...EMPTY_FIELD_REF },
})
```

**Issue:** `EMPTY_FIELD_REF` is already a plain object literal declared at module scope. Spreading it produces a new object, which is the correct immutable pattern — but since the object is only used as a source of empty-string defaults and is never mutated anywhere in the file, the spread is redundant. The Zustand updater in `updateCondition` already spreads `{ ...c, ...updates }`, so the reference would never escape to a shared mutation path.

**Fix:** Either keep the spread (it is not harmful, just slightly noisy) or remove it and document that `EMPTY_FIELD_REF` is treated as immutable:

```ts
addCondition({
  id: crypto.randomUUID(),
  left: EMPTY_FIELD_REF,
  operator: 'equal',
  right: EMPTY_FIELD_REF,
})
```

---

### IN-02: `switchToLiteral` reads stale `literalText` after a field-mode session

**File:** `src/components/builder/ConditionPanel.tsx:91-95`

```ts
const switchToLiteral = () => {
  setMode('literal')
  const numVal = Number(literalText)
  onChange(literalText !== '' && !isNaN(numVal) ? numVal : literalText)
}
```

**Issue:** When the component was in `field` mode, `literalText` was never updated (it holds whatever string it had before the last `switchToField`). Switching back to literal immediately fires `onChange` with that possibly stale or empty string, which writes it into the store before the user has typed anything. This is a minor UX inconsistency: the store update happens on mode switch, not on user input.

**Fix:** Defer the `onChange` call until the user actually edits the input, or reset `literalText` to `''` on `switchToLiteral` and skip the `onChange` call:

```ts
const switchToLiteral = () => {
  setLiteralText('')
  setMode('literal')
  // do NOT call onChange here — wait for the user to type
}
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
