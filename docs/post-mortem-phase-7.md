# Post-mortem: Phase 7 — Result / Formula Panel

**วันที่:** 2026-05-21
**Phase:** 7 — Result / Formula Panel
**ไฟล์ที่แก้:** `src/components/builder/ResultPanel.tsx`, `src/lib/schema.ts`
**สถานะ:** ✅ แก้ทั้งหมดแล้ว ผ่าน `tsc --noEmit` และ browser test

---

## ภาพรวม (Summary)

Phase 7 สร้าง ResultPanel ซึ่งเป็น UI แบบ recursive tree สำหรับสร้าง FormulaNode — ผู้ใช้สามารถ drag field เข้า slot, เพิ่ม operation (+, -, ×, ÷, mod), และ wrap node ด้วย percent ได้

หลังจากรัน code review ด้วย 5 skills พบ **2 bugs ระดับ HIGH** ที่อาจทำให้ข้อมูลเสียหาย (data corruption) + 3 MEDIUM + หลาย LOW ทั้งหมดถูกแก้ไขในครั้งเดียวกัน ก่อนที่จะ commit เข้า Phase 8

---

## Bug ที่ 1 (HIGH) — ใช้ TypeScript Cast แทนการ Validate จริง

### เกิดอะไรขึ้น

ใน `NodeEditor` ตอนที่ผู้ใช้เปลี่ยน operator (+, -, ×, ÷, mod) ผ่าน dropdown โค้ดเขียนแบบนี้:

```tsx
// โค้ดปัญหา — ResultPanel.tsx (เดิม)
onChange={(e) => onUpdate(path, { ...node, op: e.target.value as FormulaOp })}
```

### ปัญหาคืออะไร

คำว่า `as FormulaOp` ใน TypeScript คือการ **บอก compiler ว่า "เชื่อฉันเถอะ มันเป็น FormulaOp แน่"** — แต่ TypeScript จะลบ cast นี้ทิ้งตอน compile เป็น JavaScript ที่รันจริง

เปรียบเหมือน: มีด่านตรวจว่าต้องมีบัตร ID เท่านั้น แต่ TypeScript cast คือการเขียนกระดาษว่า "นี่คือ ID นะ" โดยไม่ได้ตรวจจริง — ใครก็เข้าได้

### ผลที่ตามมา

ถ้ามีคนส่งค่าแปลก ๆ เข้ามา (เช่น จาก DB ที่ corrupt หรือจาก unit test ที่ inject ค่าผิด) ค่านั้นจะถูกเซฟลง Zustand store → auto-save ไป DB โดยไม่มีใครตรวจเลย สุดท้ายตอน Phase 8 พอ Formula Engine ดึงข้อมูลมาคำนวณก็จะ crash หรือให้ผลลัพธ์ผิด

### รูปแบบที่ถูกต้อง

โปรเจกต์นี้มีตัวอย่างให้แล้วใน `ConditionPanel.tsx` line 37:

```tsx
// ConditionPanel ทำถูกต้อง — ใช้ safeParse
const result = OperatorSchema.safeParse(e.target.value)
if (result.success) onChange(result.data)
```

### วิธีแก้

เพิ่ม `export const FormulaOpSchema = z.enum(['+', '-', '*', '/', '%'])` ใน `schema.ts` แล้วใช้ `.safeParse()` แบบเดียวกัน:

```tsx
// ResultPanel.tsx (ใหม่)
onChange={(e) => {
  const result = FormulaOpSchema.safeParse(e.target.value)
  if (result.success) onUpdate(path, { ...node, op: result.data })
}}
```

### ทำไมถึงหลุดผ่าน

TypeScript ไม่ warning เรื่อง `as cast` ถ้า type ดูเหมาะสม — compiler เชื่อ developer ทันที ไม่มี linting rule ที่จับ pattern นี้โดยเฉพาะ ต้องใช้ code review ถึงจะเจอ

---

## Bug ที่ 2 (HIGH) — Schema รองรับ `boolean` แต่ UI ทำไม่ได้

### เกิดอะไรขึ้น

ใน `schema.ts` line 37 (เดิม):

```typescript
export const LiteralValueSchema = z.union([z.string(), z.number(), z.boolean()])
```

schema บอกว่า literal value ของ FormulaNode เป็นได้ทั้ง string, number, **และ boolean**

แต่ใน `NodeEditor` ตัว literal branch แสดงแค่ `<input type="text" />` ธรรมดา ซึ่งรับแค่ตัวอักษร

### ปัญหาคืออะไร

ลองนึกภาพ: มีสูตรถูกบันทึกใน DB ว่า `{ type: 'literal', value: true }` (boolean)

ตอน render: `String(true)` = `"true"` → input แสดงคำว่า "true" ดูเหมือนโอเค

แต่ทันทีที่ผู้ใช้คลิกที่ input และกด backspace หนึ่งครั้ง → `value` กลายเป็น `"tru"` (string) → **boolean ถูกแทนที่ด้วย string โดยไม่มีใครรู้** — auto-save จะเซฟค่าที่ผิดนี้ลง DB ทันที

เปรียบเหมือน: ฟอร์มกรอกอายุ แต่ช่องรับทั้งตัวเลขและ checkbox — ถ้าใครกรอก checkbox แล้วแก้ไขจะได้ตัวเลขแทน

### วิธีแก้

ทางเลือก 1 (เลือกใช้): **จำกัด schema ให้ตรงกับ UI capability**

```typescript
// schema.ts (ใหม่) — ตัด boolean ออก
export const LiteralValueSchema = z.union([z.string(), z.number()])
```

ทางเลือก 2 (ไม่เลือก): เพิ่ม UI สำหรับ boolean (toggle/checkbox) — ซับซ้อนกว่าและ Phase 7 ยังไม่ต้องการ

### ทำไมถึงหลุดผ่าน

เป็น pattern "schema บอกว่าทำได้แต่ UI ทำไม่ได้" ซึ่งมองไม่เห็นจาก TypeScript เพราะ TypeScript แค่เช็ค type compatibility ไม่ได้เช็ค UI capability ต้องใช้ code review หรือ E2E test ที่ inject boolean value ถึงจะเจอ

---

## Bug ที่ 3 (MEDIUM) — Magic Number ขัดแย้งกับ Schema

### เกิดอะไรขึ้น

```typescript
// ResultPanel.tsx (เดิม)
const MAX_DEPTH = 5
```

แต่ใน `schema.ts`:
```typescript
FORMULA_DEPTH: 20,
```

### ปัญหาคืออะไร

UI จะไม่ให้สร้าง formula tree ลึกกว่า 5 ชั้น แต่ schema ยอมรับถึง 20 ชั้น

ผลที่ตามมาคือ: ถ้าใครสร้าง formula ลึก 10 ชั้นในระบบอื่น แล้ว import เข้ามา — tree จะ **render ถูกต้อง** แต่ผู้ใช้จะ **ต่อ node เพิ่มไม่ได้เลย** เพราะปุ่ม `+op` และ `%` จะหายไปทั้งหมด โดยไม่มี error message อธิบาย

### วิธีแก้

```typescript
// ResultPanel.tsx (ใหม่) — derive จาก BUILDER_LIMITS + อธิบาย why
const UI_MAX_DEPTH = Math.min(8, BUILDER_LIMITS.FORMULA_DEPTH)
```

ตอนนี้ถ้า BUILDER_LIMITS.FORMULA_DEPTH เพิ่มในอนาคต UI cap จะขยายตามอัตโนมัติ (สูงสุด 8 เพื่อ UX)

### ทำไมถึงหลุดผ่าน

ตอนเขียนครั้งแรกตั้ง `MAX_DEPTH = 5` เพราะ "5 น่าจะพอ" โดยไม่ได้ไปดูว่า schema ตั้งไว้เท่าไหร่ — เป็น pattern ที่พบบ่อยเวลา constant 2 ตัวควรจะ sync กัน แต่กลับถูก define แยกกัน

---

## Bug ที่ 4 (MEDIUM) — `updateAtPath` ล้มเหลวเงียบ ๆ + dirty flag

### เกิดอะไรขึ้น

```typescript
// updateAtPath (เดิม) — return root เงียบ ๆ
function updateAtPath(root: FormulaNode, path: NodePath, next: FormulaNode): FormulaNode {
  if (path.length === 0) return next
  const [head, ...tail] = path
  if (root.type === 'operation' && (head === 'left' || head === 'right')) { ... }
  if (root.type === 'percent' && head === 'node') { ... }
  return root  // ← no-op เงียบ ๆ
}
```

### ปัญหาคืออะไร

ถ้า path กับ node type ไม่ match (เช่น path บอกว่า 'left' แต่ node เป็น field node) function จะ return root เดิมโดยไม่เปลี่ยนอะไร — แต่ caller ยังคิดว่า update สำเร็จ

ผลคือ: Zustand `isDirty = true` → auto-save ยิง → DB ถูก write → แต่ tree ไม่ได้เปลี่ยนเลย

เปรียบเหมือน: กดบันทึก Word แล้ว Word บอกว่า "บันทึกแล้ว" แต่ไฟล์ไม่ได้เปลี่ยน — API call เสียเปล่า และ isDirty flag ผิด

### วิธีแก้

เพิ่ม dev warning เพื่อให้ debug ได้เร็วขึ้นถ้าเกิดขึ้น:

```typescript
// updateAtPath (ใหม่)
if (process.env.NODE_ENV !== 'production') {
  console.warn('[updateAtPath] path segment', head, 'does not match node type', root.type)
}
return root
```

Warning นี้จะไม่แสดงใน production — ปลอดภัย

### ทำไมถึงหลุดผ่าน

Path/type mismatch ไม่ควรเกิดใน normal usage — แต่ถ้าเกิด (เช่น จาก refactor ที่เปลี่ยน path construction) จะ debug ยากมากเพราะ silent failure ไม่มี stack trace ให้ตาม

---

## Bug ที่ 5 (MEDIUM) — `String(node.value)` อาจแสดง "undefined" หรือ "null"

### เกิดอะไรขึ้น

```tsx
// literal input (เดิม)
<input type="text" value={String(node.value)} ... />
```

### ปัญหาคืออะไร

`String(undefined)` = `"undefined"` | `String(null)` = `"null"`

ถ้า literal node ถูก load จาก DB ที่มี schema migration ที่ไม่สมบูรณ์ หรือมีการ write ข้อมูลผ่าน API โดยตรง input อาจแสดงคำว่า "undefined" หรือ "null" ซึ่งผู้ใช้เห็นแล้วงง React จะ warn ด้วยว่า "controlled input changed to uncontrolled"

### วิธีแก้

```tsx
// literal input (ใหม่)
<input type="text" value={String(node.value ?? '')} ... />
```

`??` = "ถ้า null หรือ undefined ให้ใช้ '' แทน"

---

## Issues ระดับ LOW ที่แก้ในครั้งเดียวกัน

### L-1: Buttons ไม่มี `aria-label`

**ปัญหา:** ปุ่ม abc, +op, %, ⊞, ×collapse, ×unwrap ใช้แค่ `title` ซึ่ง screen reader บน mobile อ่านไม่ได้

**แก้:** เพิ่ม `aria-label="Switch to literal value"`, `aria-label="Add operation"` ฯลฯ ทุกปุ่ม

**ทำไมสำคัญ:** ผู้ใช้ที่ใช้ keyboard navigation หรือ screen reader จะใช้ app ไม่ได้เลยถ้าไม่มี aria-label

---

### L-2: `NodeEditor` ใหญ่เกิน 50 บรรทัด

**ปัญหา:** function เดียวทำ 4 งาน (field/literal/operation/percent) รวม ~160 บรรทัด ทดสอบยาก แก้ยาก

**แก้:** แตกเป็น 4 sub-components + 1 dispatcher:
- `FieldNodeEditor` (~35 lines)
- `LiteralNodeEditor` (~30 lines)
- `OperationNodeEditor` (~35 lines)
- `PercentNodeEditor` (~20 lines)
- `NodeEditor` dispatcher (~10 lines)

แต่ละ component มีหน้าที่เดียว testable แยกกันได้

---

### L-3: `wrapInOperation` ซ้ำ 2 ครั้ง

**ปัญหา:** pattern สร้าง operation node ซ้ำใน field branch และ literal branch

**แก้:** extract เป็น helper function:
```typescript
function wrapInOperation(left: FormulaNode): FormulaNode {
  return { type: 'operation', op: '+', left, right: { type: 'field', ref: EMPTY_FIELD_REF } }
}
```

---

### L-4: `EMPTY_REF` ชื่อไม่ตรงกับ `ConditionPanel`

**ปัญหา:** ResultPanel ใช้ `EMPTY_REF`, ConditionPanel ใช้ `EMPTY_FIELD_REF` — ต่างกันโดยไม่มีเหตุผล

**แก้:** rename เป็น `EMPTY_FIELD_REF` ให้ consistent

---

### L-5: `handleNodeUpdate` ขาด `useCallback`

**ปัญหา:** function ถูก recreate ทุก render ทำให้ React child components ที่ depend on มัน re-render โดยไม่จำเป็น

**แก้:**
```tsx
const handleNodeUpdate = useCallback((path, next) => {
  onUpdate({ expression: updateAtPath(result.expression, path, next) })
}, [result.expression, onUpdate])
```

---

### L-6: Result name input ไม่ trim และไม่มี length limit

**ปัญหา:** ผู้ใช้พิมพ์ space นำหน้าได้ หรือพิมพ์ชื่อยาวเกิน schema limit ได้

**แก้:**
```tsx
onChange={(e) =>
  onUpdate({ name: e.target.value.trimStart().slice(0, BUILDER_LIMITS.STR_NAME) })
}
```

---

## Validation

| Test | ผล |
|------|-----|
| `npx tsc --noEmit` | ✅ Pass — ไม่มี error |
| `npm run lint` | ✅ Pass — clean |
| Browser: Add result → Drop field | ✅ ทำงาน |
| Browser: +op → สร้าง operation node | ✅ ทำงาน |
| Browser: op select → เปลี่ยน operator | ✅ ทำงาน |
| Browser: collapse × → กลับเป็น leaf node | ✅ ทำงาน |
| Browser: % → wrap percent | ✅ ทำงาน |
| Browser: unwrap × → ถอด percent | ✅ ทำงาน |
| Browser: auto-save "Saved" | ✅ ปรากฏทุก action |
| Accessibility tree: aria-labels | ✅ ทุก button มี aria-label ถูกต้อง |

หมายเหตุ: ยังไม่ได้ทดสอบด้วย screen reader จริง และยังไม่มี unit test สำหรับ `updateAtPath` (กำหนดทำ Phase 9)

---

## Action Items

| งาน | Owner | Phase |
|-----|-------|-------|
| Unit test สำหรับ `updateAtPath` — ทดสอบทุก path/type combination | Kru Dew | Phase 9 |
| Unit test สำหรับ `wrapInOperation` | Kru Dew | Phase 9 |
| E2E test: add result → build operation tree → verify state | Kru Dew | Phase 9 |
| Screen reader manual test (NVDA / VoiceOver) | Kru Dew | Phase 9 |
| Lint rule สำหรับ detect `as Cast` บน event handler | Kru Dew | Phase 9 |
| พิจารณาสร้าง `src/lib/formula-defaults.ts` สำหรับ share `EMPTY_FIELD_REF` | Kru Dew | Phase 9 |

---

## บทเรียนสำหรับ Phase ถัดไป

### 1. "TypeScript ผ่าน ≠ Runtime ปลอดภัย"

`as cast` ทำให้ TypeScript หยุดบ่น แต่ไม่ได้ validate ค่าจริง — **ทุก user input ที่มาจาก event handler ต้องผ่าน `.safeParse()` เสมอ** โดยเฉพาะ `<select>` และ `<input>` ที่รับค่าจาก DOM

### 2. "Schema กับ UI ต้องตรงกันเสมอ"

ถ้า schema รับ type หนึ่งได้ แต่ UI ทำไม่ได้ — ต้อง **restrict schema ให้ match UI** หรือ **เพิ่ม UI path ให้ครบ** ไม่ใช่ปล่อยไว้แล้วหวังว่า input นั้นจะไม่มาจาก DB เพราะมีวันมาแน่

### 3. "Constant ที่เกี่ยวกัน ต้อง derive กัน"

ถ้ามี 2 ค่าที่ควรสัมพันธ์กัน (เช่น UI depth limit กับ schema depth limit) ให้ derive ค่าหนึ่งจากอีกค่า อย่า define แยกกัน เพราะ 2 ค่าที่ define แยกมีวันที่ drift กัน

### 4. "Silent failure คือ worst failure"

Function ที่ล้มเหลวเงียบ ๆ (return ค่าเดิมโดยไม่แจ้ง) ทำให้ debug ยากกว่า error ที่ชัดเจนมาก — ถ้า function ไม่ควรถึง code path นั้น ให้ `console.warn` ใน dev อย่าง น้อย

### 5. "Pattern ที่ถูกต้องอยู่ใน codebase แล้ว"

ก่อนจะ implement อะไรใหม่ ให้ดูว่า component อื่นใน project ทำแบบไหน — `ConditionPanel.tsx` มีตัวอย่าง `.safeParse()` ที่ถูกต้องอยู่แล้ว แต่ `ResultPanel` ไม่ได้ follow pattern นั้น เพราะไม่ได้ cross-check

---

*Post-mortem นี้เขียนหลังจากรัน code review ด้วย `/code-review`, `/gsd-code-review`, `/coding-standards`, `/frontend-design`, `/frontend-patterns` และ apply fixes ทั้งหมดใน session เดียวกัน — 2026-05-21*
