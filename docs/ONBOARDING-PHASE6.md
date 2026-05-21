# Onboarding Guide — Phase 6: Condition Panel

> สำหรับ Developer มือใหม่ที่เพิ่งเข้าร่วมโปรเจกต์และต้องเข้าใจ Phase 6 ก่อนเริ่ม Phase 7

---

## Phase 6 คืออะไร?

Phase 6 สร้างส่วน "Condition" ของ Builder ขึ้นมา — ให้ผู้ใช้กำหนดเงื่อนไขแบบ:

```
[Table1.FieldA]   [Greater Than]   [Table2.FieldB]
[Table1.Salary]   [Less Than]      [50000]
[Table2.Name]     [Contains]       [สมชาย]
```

ผู้ใช้ drag field จากแผง Field Panel มาวางในช่องซ้ายและขวา หรือพิมพ์ค่าตรง ๆ ในช่องขวาก็ได้ ทุกการเปลี่ยนแปลงบันทึกลง database อัตโนมัติโดยไม่ต้องกดปุ่ม Save

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/components/builder/ConditionPanel.tsx` | Component หลักของ Phase 6 |
| `src/components/dnd/DropZone.tsx` | ช่องรับ Field ที่ drag มาวาง |
| `src/components/dnd/BuilderDndContext.tsx` | ระบบ Drag & Drop ทั้งหมดของ app |
| `src/store/builder-store.ts` | Zustand store เก็บ state ทุกอย่าง |
| `src/hooks/use-auto-save.ts` | บันทึกอัตโนมัติผ่าน tRPC |
| `src/lib/schema.ts` | Zod schema สำหรับ validate ข้อมูล |
| `src/types/index.ts` | TypeScript types ทุกชนิด |

---

## โครงสร้างของ ConditionPanel.tsx

ไฟล์นี้แบ่งเป็น component ย่อยซ้อนกัน 4 ชั้น เหมือนกล่องในกล่อง:

```
ConditionPanel                ← export ออกไปใช้ใน Builder
  └── ConditionRow            ← แถวเงื่อนไขแต่ละอัน
        ├── DropZone (ซ้าย)   ← ช่องรับ Field ฝั่งซ้าย
        ├── OperatorSelect    ← Dropdown เลือก Equal / Greater Than / ฯลฯ
        └── RightSlot         ← ช่องฝั่งขวา (ไม่ว่าจะเป็น Field หรือค่าตรง ๆ)
              ├── DropZone    ← แสดงเมื่ออยู่ในโหมด field
              └── LiteralInput ← แสดงเมื่ออยู่ในโหมด literal
```

---

## Concept ที่ต้องเข้าใจก่อน

### 1. FieldRef คืออะไร?

`FieldRef` คือ object บอกว่า "field ไหนจาก table ไหน":

```typescript
type FieldRef = {
  tableId: string    // เช่น "table-abc-123"
  fieldId: string    // เช่น "field-xyz-456"
  label: string      // เช่น "Table1.Salary" — สำหรับแสดงผล
}
```

ถ้า `tableId === ''` แปลว่ายังไม่ได้เลือก (ใช้ `EMPTY_FIELD_REF` แทน null)

### 2. Condition มีหน้าตายังไง?

```typescript
type Condition = {
  id: string         // UUID สร้างโดย crypto.randomUUID()
  left: FieldRef     // ฝั่งซ้าย — เป็น FieldRef เสมอ
  operator: Operator // 'equal' | 'greater_than' | 'less_than' | ...
  right: FieldRef | string | number  // ฝั่งขวา — เป็นได้ทั้งสองแบบ
}
```

### 3. isFieldRef — Type Guard

เนื่องจาก `right` เป็นได้ทั้ง FieldRef และ string/number เราต้องแยกก่อนใช้:

```typescript
function isFieldRef(value: FieldRef | LiteralValue): value is FieldRef {
  return typeof value === 'object' && value !== null && 'tableId' in value
}
```

ใช้งาน:
```typescript
if (isFieldRef(condition.right)) {
  // TypeScript รู้ว่าเป็น FieldRef แน่ ๆ
  console.log(condition.right.label)
} else {
  // TypeScript รู้ว่าเป็น string | number
  console.log(condition.right * 2)
}
```

---

## Pattern สำคัญ: Fully-Controlled Component

นี่คือ concept ที่สำคัญที่สุดใน Phase 6 และเป็น bug ที่ทีมเจอระหว่าง development

### ปัญหาที่เคยเกิด (วิธีผิด)

```typescript
// ❌ วิธีนี้มีปัญหา
function RightSlot({ value, onChange }) {
  const initialMode = isFieldRef(value) ? 'field' : 'literal'
  const [mode, setMode] = useState(initialMode)  // ❌ จำค่าแรก แล้วไม่อัปเดต!
  // ...
}
```

`useState(initialMode)` ใช้ค่าแค่ตอน component mount ครั้งแรก ถ้า parent ส่ง value ใหม่มาทีหลัง (เช่น undo, โหลดจาก DB) component จะยังแสดงโหมดเดิม

### วิธีที่ถูกต้อง (Fully-Controlled)

```typescript
// ✅ วิธีนี้ถูกต้อง
function RightSlot({ value, onChange }) {
  // คำนวณจาก prop ทุก render — ไม่ต้องจำ state เองเลย
  const mode = isFieldRef(value) ? 'field' : 'literal'
  // ...
}
```

`mode` คำนวณใหม่ทุกครั้งที่ render ดังนั้นถ้า `value` เปลี่ยน → `mode` เปลี่ยนตามอัตโนมัติ

### ทำไมต้องเขียนแบบนี้?

เพราะ React มีกฎ ESLint `react-hooks/no-direct-set-state-in-use-effect` ที่ห้าม pattern แบบนี้:

```typescript
// ❌ ESLint ไม่ให้ทำ
useEffect(() => {
  if (isFieldRef(value)) {
    setMode('field')  // ← ห้ามเรียก setState ใน effect ที่ sync กับ prop
  }
}, [value])
```

วิธีที่ปลอดภัยที่สุดคือ derive โดยตรงจาก prop โดยไม่ใช้ state เลย

---

## ระบบ Drag & Drop ทำงานยังไง?

ระบบ DnD แบ่งเป็น 3 ชั้น:

### ชั้นที่ 1: BuilderDndContext (ครอบทุกอย่าง)

```tsx
// ใน layout — ครอบ FieldPanel, ConditionPanel, ResultPanel ทั้งหมด
<BuilderDndContext>
  <FieldPanel />
  <ConditionPanel />
  <ResultPanel />
</BuilderDndContext>
```

Context นี้รับรู้ drag events ทั้งหมด และกระจาย drop event ไปยัง handler ที่ลงทะเบียนไว้

### ชั้นที่ 2: DraggableField (ที่ Field Chip)

Field chip ในแผง Field Panel ถูกห่อด้วย `DraggableField` ซึ่งใช้ `useDraggable` จาก @dnd-kit และแนบ `FieldRef` ไว้ใน data เพื่อส่งไปตอน drop

### ชั้นที่ 3: DropZone (ที่ Condition)

```tsx
<DropZone
  id="condition:abc-123:left"    // ต้อง unique ทั่วทั้งหน้า
  currentValue={condition.left}  // แสดงค่าปัจจุบัน
  onDrop={(fieldRef) => onUpdate({ left: fieldRef })}  // รับ FieldRef แล้วอัปเดต store
  placeholder="Drop field"
/>
```

`useDndDropHandler(id, onDrop)` ภายใน DropZone ลงทะเบียน callback กับ BuilderDndContext เมื่อมีการ drop บน `id` นั้น callback จะถูกเรียก

---

## Zustand Store Integration

ConditionPanel ดึงข้อมูลและ actions จาก store แบบนี้:

```typescript
const { state, addCondition, removeCondition, updateCondition } = useBuilderStore()
```

### สร้าง Condition ใหม่

```typescript
const handleAdd = () => {
  addCondition({
    id: crypto.randomUUID(),
    left: EMPTY_FIELD_REF,    // ช่องซ้ายว่างก่อน
    operator: 'equal',
    right: EMPTY_FIELD_REF,   // ช่องขวาว่างก่อน
  })
}
```

### อัปเดต Condition

```typescript
// อัปเดต operator ของ condition id นั้น ๆ
updateCondition(condition.id, { operator: 'greater_than' })

// อัปเดต left field
updateCondition(condition.id, { left: droppedFieldRef })
```

ทุก action ใน store ทำ immutable update และ set `isDirty: true` อัตโนมัติ

---

## Auto-Save ทำงานยังไง?

`useAutoSave` hook อยู่ใน layout ไม่ได้อยู่ใน ConditionPanel เลยไม่ต้องสนใจมากใน Phase 6 แต่รู้ไว้ก็ดี:

1. เมื่อ `isDirty === true` hook เริ่ม countdown 500ms
2. ถ้ามีการเปลี่ยนแปลงก่อนครบ 500ms → reset countdown (debounce)
3. เมื่อครบ 500ms → ส่งข้อมูลทั้งหมดขึ้น server ผ่าน `tRPC formula.upsert`
4. เมื่อ server ตอบกลับสำเร็จ → `isDirty` กลับเป็น `false`, แสดง "Saved"

---

## Validation ด้วย Zod

### Operator Validation (ป้องกัน Bug)

```typescript
// ใน OperatorSelect — ไม่ cast ตรง ๆ แต่ safeParse ก่อน
onChange={(e) => {
  const result = OperatorSchema.safeParse(e.target.value)
  if (result.success) onChange(result.data)
}}
```

ทำไมต้อง safeParse? เพราะ `e.target.value` เป็น `string` เสมอ ถ้า cast ตรง ๆ ว่า `as Operator` TypeScript เชื่อเลยโดยไม่เช็ค แต่ถ้า HTML มี option ที่ไม่ได้อยู่ใน type จะ bug ได้ safeParse ช่วยจับตอน runtime

### Schema ของ right side

```typescript
// src/lib/schema.ts
right: z.union([FieldRefSchema, z.string(), z.number()])
// ❌ ไม่ใช้ boolean เพราะ UI ยังไม่รองรับการ toggle true/false
```

---

## Bug ที่เคยเกิดและวิธีแก้ (สรุปจาก Post-mortem)

| Bug | สาเหตุ | วิธีแก้ |
|---|---|---|
| RightSlot ไม่อัปเดตเมื่อ parent เปลี่ยน value | ใช้ `useState(initial)` แทน derive จาก prop | เปลี่ยนเป็น `const mode = isFieldRef(value) ? ...` |
| boolean ใน store แสดงผลไม่ถูกต้อง | Schema อนุญาต boolean แต่ UI ไม่มี input สำหรับ boolean | จำกัด schema เป็นแค่ string/number |
| `as Operator` cast อาจ silently ผิด | ไม่มี runtime check | ใช้ `OperatorSchema.safeParse` |
| ESLint error: setState in useEffect | ใช้ useEffect + setState แทน derived value | ลบ state และ useEffect ออก derive ตรงจาก prop |

---

## Checklist ก่อนเริ่ม Phase 7

- ทำความเข้าใจ Fully-Controlled Pattern ใน RightSlot
- รู้ว่า DropZone ต้องมี `id` ที่ unique ทั่วทั้งหน้า
- เข้าใจ Zustand store pattern: action → `isDirty: true` → auto-save
- รู้ว่า `mode` ของ RightSlot derive จาก `value` prop ไม่ใช่ useState
- เข้าใจ `isFieldRef` type guard และเวลาที่ต้องใช้

---

## Phase 7 จะทำอะไร?

Phase 7 คือ **Formula Engine** — ส่วน Result ที่ผู้ใช้สร้าง expression ทางคณิตศาสตร์ เช่น:

```
Result1 = Table1.Salary + Table2.Bonus * (Percent / 100)
```

โดยเก็บเป็น **AST Tree** (Abstract Syntax Tree) ไม่ใช่ string เพื่อให้ evaluate, validate, และแสดงผลแบบ visual ได้

แนวคิด DnD และ Fully-Controlled Pattern ที่เรียนจาก Phase 6 จะใช้ซ้ำใน Phase 7 ด้วย

---

_อัปเดตล่าสุด: Phase 6 สำเร็จแล้ว — สถานะ ✅ Done_
