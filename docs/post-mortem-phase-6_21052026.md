# Post-Mortem: Phase 6 — Condition Panel Bugs

**วันที่:** 2026-05-21
**Phase:** 6 — ConditionPanel
**ไฟล์หลักที่เกี่ยวข้อง:** `src/components/builder/ConditionPanel.tsx`, `src/lib/schema.ts`, `src/components/builder/FieldPanel.tsx`, `src/components/dnd/BuilderDndContext.tsx`, `src/hooks/use-auto-save.ts`
**Commits fix:** 6d7a43f, 0da2382, 36863d3, 88c97f2

---

## Summary

Phase 6 สร้าง ConditionPanel ผ่านแบบ functional แต่ code review พบ bug 5 จุดใน `ConditionPanel.tsx` และ 3 จุด pre-existing ใน Phase 4–5 ที่ ESLint จับได้ ทั้งหมดถูก fix และ validate แล้ว ไม่มีจุดใดที่ถึง production เพราะจับได้ก่อน merge

| ID | ระดับ | Bug | สถานะ |
|---|---|---|---|
| WR-01 | Warning | RightSlot stale state | ✅ Fixed |
| WR-02 | Warning | Boolean literal ไม่มี UI path | ✅ Fixed |
| WR-03 | Warning | Unsafe `as Operator` cast | ✅ Fixed |
| IN-01 | Info | Redundant spread ของ EMPTY_FIELD_REF | ✅ Fixed |
| IN-02 | Info | switchToLiteral เรียก onChange ก่อน user พิมพ์ | ✅ Fixed |
| PRE-1 | ESLint Error | setState ใน useEffect (FieldPanel) | ✅ Fixed |
| PRE-2 | ESLint Error | Ref update during render (BuilderDndContext) | ✅ Fixed |
| PRE-3 | ESLint Warn | eslint-disable-next-line suppress ผิด line | ✅ Fixed |

---

## Bug ที่ 1 (WR-01) — "กล่องจำผิด" (Stale State ใน RightSlot)

### อธิบายภาษาชาวบ้าน

ลองนึกภาพว่ากล่องกรอกข้อมูลมีความจำสั้น — มันจำค่าตอนที่เกิดมาครั้งแรกได้ แต่ถ้า **คนอื่นมาเปลี่ยนค่าข้างนอก** กล่องก็ยังแสดงค่าเก่าของตัวเองอยู่ โดยไม่รู้ว่าโลกข้างนอกเปลี่ยนไปแล้ว

### Root Cause

`RightSlot` (`ConditionPanel.tsx:86-88`) เก็บ `mode` และ `literalText` ใน `useState` โดย initialize จาก `value` prop ครั้งแรกครั้งเดียว:

```tsx
// โค้ดที่มีปัญหา
const initialMode = isFieldRef(value) ? 'field' : 'literal'
const [mode, setMode] = useState<'field' | 'literal'>(initialMode)
const [literalText, setLiteralText] = useState<string>(isFieldRef(value) ? '' : String(value))
```

`useState(X)` ใน React จะดู argument แค่ครั้งแรกที่ component mount เท่านั้น render ครั้งถัดไป argument จะถูกเพิกเฉย ดังนั้นถ้า parent (store) ส่ง `value` ใหม่มา — component จะยังแสดงค่าเก่าของตัวเองอยู่

### ทำไมถึงเป็นปัญหา

เมื่อมี Undo/Redo หรือ Bulk-load from DB ใน Phase 9 — store จะ reset `value` ทั้งหมด แต่ `RightSlot` จะยังแสดง mode กับ literalText เก่าอยู่ เหมือนกระจกที่สะท้อนภาพเมื่อกี้

### Fix

แทนที่จะเก็บ `mode` ใน state — derive จาก `value` prop โดยตรงทุก render (fully-controlled):

```tsx
// หลัง fix — ไม่มี useState สำหรับ mode แล้ว
const mode = isFieldRef(value) ? 'field' : 'literal'
const literalText = isFieldRef(value) ? '' : String(value)
```

Component กลายเป็น "กระจก" ที่สะท้อน `value` จริงๆ เสมอ

### ทำไม Fix นี้ถูก

`mode` ไม่ได้เป็น "สิ่งที่ component เป็นเจ้าของ" จริงๆ — มันเป็นแค่การอ่านค่า `value` มาแปลงรูป การเก็บมันใน state จึงสร้าง "สำเนา" ที่อาจ stale ได้

> หมายเหตุ: ESLint rule `react-hooks/set-state-in-effect` block การใช้ `useEffect` + `setState` ด้วย จึงเลือก fully-controlled เป็น solution ที่ clean ที่สุด

---

## Bug ที่ 2 (WR-02) — "ประตูที่ไม่มีป้าย" (Boolean Literal ไม่มี UI Path)

### อธิบายภาษาชาวบ้าน

Schema บอกว่าช่อง "right" ของ condition รับค่าได้ 3 แบบ: ตัวเลข, ข้อความ, **และ true/false** แต่ UI ไม่มี input ใดเลยที่รองรับ `boolean` ถ้า DB เก็บ `false` ไว้แล้ว user คลิก edit — ค่า `false` จะถูกแปลงเป็น string `"false"` โดยอัตโนมัติ และ boolean type จะหายไปตลอดกาล

### Root Cause

`ConditionSchema.right` (`schema.ts:51`) ใช้ `LiteralValueSchema = z.union([z.string(), z.number(), z.boolean()])`:

```ts
// schema.ts ก่อน fix
right: z.union([FieldRefSchema, LiteralValueSchema])
```

แต่ `LiteralInput` component รับแค่ string แล้วแปลงเป็น number เท่านั้น — ไม่มี boolean branch:

```tsx
// LiteralInput ทำแค่นี้
onChange(raw !== '' && !isNaN(numVal) ? numVal : raw)  // string หรือ number เท่านั้น
```

ผล: boolean `false` จาก DB จะแสดงผลเป็น `"false"` (string) แต่พอ user แก้ครั้งแรก boolean type จะหายไปถาวร (silent data corruption)

### Fix

ปิด schema ให้ตรงกับ UI ก่อน จนกว่าจะมี boolean toggle จริงๆ:

```ts
// schema.ts หลัง fix
right: z.union([FieldRefSchema, z.string(), z.number()])
// boolean ถูก exclude อย่างชัดเจน
```

### บทเรียน

Schema กับ UI ต้อง agree กัน เสมอ ถ้า UI handle ได้แค่ string/number ก็ต้องบอก schema ด้วย ไม่งั้น "ข้อมูลที่ schema ยอมรับ" กับ "ข้อมูลที่ UI แสดงได้" จะต่างกัน สร้าง silent data corruption

---

## Bug ที่ 3 (WR-03) — "เชื่อใจโดยไม่ตรวจ" (Unsafe Type Cast)

### อธิบายภาษาชาวบ้าน

เหมือนสร้างเมนูอาหาร 5 ข้อ แล้วเวลา user เลือก เราแค่รับ string มาแล้วบอกว่า "เชื่อเลย นี่คือตัวเลือก valid แน่นอน" โดยไม่ตรวจสอบ — ถ้าวันนึงมีคนแก้ HTML แต่ลืมแก้ TypeScript ระบบจะรับค่า invalid โดยไม่รู้ตัว

### Root Cause

`ConditionPanel.tsx:35` ใช้ `as Operator` cast ที่ bypass runtime check:

```tsx
// ก่อน fix
onChange={(e) => onChange(e.target.value as Operator)}
//                                     ^^^^^^^^^^^ TypeScript เชื่อทันที ไม่ตรวจ runtime
```

ตอนนี้ปลอดภัยเพราะ `<option>` values กับ `OPERATORS` array ชุดเดียวกัน แต่ถ้าอนาคต developer เพิ่ม option ใน HTML แต่ลืมเพิ่มใน `OPERATORS` — TypeScript จะไม่เตือน

### Fix

ตรวจสอบด้วย `OperatorSchema.safeParse` ก่อนเชื่อ:

```tsx
// หลัง fix
import { OperatorSchema } from '@/lib/schema'

onChange={(e) => {
  const result = OperatorSchema.safeParse(e.target.value)
  if (result.success) onChange(result.data)
}}
```

### บทเรียน

`as Type` = "ปิดตา TypeScript ชั่วคราว" ใช้ได้ถ้ามั่นใจ 100% แต่ถ้า value มาจาก external (DOM, API, user input) — ควร validate ด้วย `safeParse` เสมอ

---

## Bug ที่ 4 (IN-02) — "พูดก่อนถาม" (Store Update ก่อน User พิมพ์)

### อธิบายภาษาชาวบ้าน

เหมือนพนักงานที่ submit form แทนเราโดยอัตโนมัติทันทีที่เราหยิบปากกาขึ้น — ก่อนที่เราจะเขียนอะไรเลย

### Root Cause

`switchToLiteral` (`ConditionPanel.tsx:91-95`) เรียก `onChange` ทันทีโดยใช้ `literalText` ที่อาจว่างหรือค้างจากครั้งก่อน:

```tsx
// ก่อน fix
const switchToLiteral = () => {
  setMode('literal')
  const numVal = Number(literalText)
  onChange(literalText !== '' && !isNaN(numVal) ? numVal : literalText)
  // ^^^ บันทึก store ทันที ด้วย literalText ที่ยังไม่ได้พิมพ์!
}
```

ผล: store ได้รับค่าที่ user ยังไม่ได้ตั้งใจพิมพ์ auto-save บันทึกข้อมูลที่ผิด

### Fix

Switch mode เงียบๆ ก่อน รอให้ user พิมพ์ค่อยบันทึก:

```tsx
// หลัง fix
const switchToLiteral = () => {
  setMode('literal')
  // ไม่เรียก onChange ที่นี่ — รอ user พิมพ์ใน LiteralInput
}
```

---

## Bug ที่ 5 (IN-01) — "ถ่ายเอกสารโดยไม่จำเป็น" (Redundant Spread)

### Root Cause

`handleAdd` (`ConditionPanel.tsx:193-196`) spread `EMPTY_FIELD_REF` ทั้งที่ object ไม่เคยถูก mutate:

```tsx
// ก่อน fix — spread ซ้ำซ้อน
addCondition({
  left: { ...EMPTY_FIELD_REF },
  right: { ...EMPTY_FIELD_REF },
})

// หลัง fix — ส่ง reference ตรงๆ ได้เลย
addCondition({
  left: EMPTY_FIELD_REF,
  right: EMPTY_FIELD_REF,
})
```

Zustand store ทำ immutable update ด้วย `{ ...c, ...updates }` เอง จึงไม่มีความเสี่ยง mutation

---

## 3 Pre-existing Bugs (Phase 4–5)

### PRE-1 — "คนงานวุ่นวาย" (setState ใน useEffect — FieldPanel.tsx:99)

**Root Cause:** `useEffect` เรียก `setNameValue` synchronously ภายใน effect body ทำให้ ESLint rule `react-hooks/set-state-in-effect` flag เป็น error เพราะอาจ trigger cascading renders

**Fix:** ลบ `useEffect` ออก เพิ่ม `startEditing()` function ที่ reset `nameValue` ตอนเริ่ม edit แทน — เรียบง่ายกว่า ไม่มี cascade

```tsx
// หลัง fix
const startEditing = () => {
  setNameValue(table.name)  // reset ทุกครั้งที่เริ่ม edit
  setEditingName(true)
}
```

### PRE-2 — "เขียนกระดานระหว่างพูด" (Ref Update During Render — BuilderDndContext.tsx:46)

**Root Cause:** `onDropRef.current = onDrop` ทำงานระหว่าง render (top-level ของ function body) ESLint rule `react-hooks/refs` บอกว่า ref ไม่ควรถูกอ่าน/เขียนระหว่าง render

**Fix:** ย้าย assignment เข้า `useEffect` ที่ไม่มี deps (runs after every render):

```tsx
// หลัง fix
useEffect(() => {
  onDropRef.current = onDrop  // update หลัง render เสร็จแล้ว
})
```

### PRE-3 — "ป้ายห้ามจอดที่ผิดที่" (eslint-disable ผิด Line — use-auto-save.ts:74)

**Root Cause:** `// eslint-disable-next-line react-hooks/exhaustive-deps` อยู่ที่บรรทัด 74 แต่ suppresses บรรทัด 75 ซึ่งเป็นแค่ comment — ส่วน warning จริงๆ อยู่บรรทัด 77 (deps array) ทำให้ directive เป็น "unused" พร้อมกันกับที่ warning ยังอยู่

**Fix:** ย้าย comment ให้อยู่ตรงหน้า deps array พอดี

---

## ทำไม Bugs เหล่านี้ถึงผ่านมาได้

| Bug | เหตุผลที่ผ่านมา |
|---|---|
| WR-01 Stale state | เป็น "future bug" — ใช้งานปกติจนกว่าจะมี undo/reload ซึ่ง Phase 6 ยังไม่มี |
| WR-02 Boolean gap | Schema กว้างกว่า UI ตั้งแต่แรก แต่ไม่มีข้อมูล boolean จริงในระบบตอนนี้ |
| WR-03 Unsafe cast | Code ทำงานถูกในปัจจุบัน แค่ไม่ defensive พอสำหรับอนาคต |
| IN-02 Premature onChange | เห็นได้ยากถ้าไม่ test เฉพาะ mode-switch scenario |
| Pre-existing ESLint | ESLint rules บางตัวถูก add หลังจาก Phase 4–5 เขียนไปแล้ว |

ทั้งหมดจับได้ใน **code review** ก่อน merge — ไม่มีอะไรถึง production

---

## Validation

- `npx tsc --noEmit` ✅ — ไม่มี type error
- `npm run lint` ✅ — 0 errors, 0 warnings
- Browser preview ✅ — condition panel render ปกติ, add/remove/operator/mode-switch ทำงานครบ

---

## Action Items

| # | งาน | ทำเมื่อ |
|---|---|---|
| 1 | เพิ่ม test สำหรับ RightSlot sync เมื่อ value prop เปลี่ยน (undo/load scenario) | Phase 9 (Testing) |
| 2 | เพิ่ม boolean toggle input ใน RightSlot ถ้า product ต้องการ boolean conditions | ถ้า product ต้องการ |
| 3 | Review `as Type` casts ทั่วโปรเจกต์ว่ามีจุดอื่น unsafe เหมือนกันไหม | Phase 9 |
| 4 | เพิ่ม focus ring (`focus-visible:ring-2`) ให้ interactive buttons ใน ConditionPanel | Phase 9 (Polish) |

---

## บทเรียนหลัก 3 ข้อ

### 1. "State ที่ derive ได้จาก prop — ไม่ควรเป็น state"

ถ้าค่าคำนวณจาก prop ได้ตรงๆ อย่าเก็บใน `useState` เพราะจะ stale เสมอเมื่อ prop เปลี่ยน ให้ derive โดยตรงแทน (fully-controlled pattern)

### 2. "Schema กับ UI ต้อง agree กัน — ไม่งั้น data ซ่อนปัญหา"

ถ้า UI แสดงได้แค่ string/number ก็ต้องบอก schema ด้วย อย่าปล่อยให้ schema กว้างกว่าที่ UI handle ได้ เพราะจะเกิด silent data corruption ที่เห็นยากมาก

### 3. "ตรวจสอบที่ system boundary เสมอ — อย่าเชื่อ `as Type` กับ external value"

DOM events, user input, API response — ทั้งหมดนี้ต้อง validate ก่อน (`safeParse`) เพราะ TypeScript ไม่ช่วยอะไรได้ที่ runtime ถ้า cast ไปแล้ว

---

_เขียนโดย: Claude (post-mortem skill)_
_วันที่: 2026-05-21_
_Phase: 6 — Condition Panel_
