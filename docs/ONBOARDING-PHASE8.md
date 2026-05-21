# Onboarding Guide — Phase 8: Formula Engine + RUN

> สำหรับ Developer มือใหม่ที่เพิ่งเข้าร่วม project หรือกำลังจะเริ่ม Phase 9
> เขียนแบบภาษาชาวบ้าน อ่านแล้วเข้าใจได้โดยไม่ต้องมีพื้นฐาน advanced

---

## Phase 8 ทำอะไร? (ภาพรวม 2 นาที)

ก่อน Phase 8 — แอปสร้าง formula และ condition ได้แล้ว แต่ยังไม่สามารถ **คำนวณผลลัพธ์จริงๆ** ได้

Phase 8 เพิ่ม **ปุ่ม RUN** — กดแล้วได้คำตอบว่า:
- condition แต่ละข้อผ่านไหม? (`true` / `false`)
- formula คำนวณได้เท่าไหร่? (ตัวเลขจริง)

```
ผู้ใช้กด RUN
     ↓
ส่ง BuilderState + mock data ไปยัง server
     ↓
server คำนวณผล
     ↓
แสดงผลใน PreviewBox
```

---

## ไฟล์ใหม่ที่เพิ่มใน Phase 8

| ไฟล์ | หน้าที่ | ย่อความสั้น |
|------|--------|-------------|
| `src/lib/formula-engine.ts` | คำนวณ FormulaNode → ตัวเลข | สมองหลัก |
| `src/lib/condition-evaluator.ts` | เช็คเงื่อนไข → true/false | ผู้ตัดสิน |

ไฟล์ที่แก้ไข:

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `src/server/routers/formula.ts` | เพิ่ม `evaluate` mutation |
| `src/components/builder/PreviewBox.tsx` | เขียนใหม่ทั้งหมด + mock data editor |
| `src/components/builder/BuilderShell.tsx` | เพิ่ม handleRun + mockOverrides state |

---

## ทำความเข้าใจ DataContext ก่อนอื่น

ก่อนอ่านโค้ดต้องเข้าใจ type นี้ก่อน:

```typescript
// src/lib/formula-engine.ts บรรทัด 3
type DataContext = Record<string, Record<string, number | string>>
```

แปลเป็นภาษาคน:

```
DataContext คือ "กล่องข้อมูล" ที่มีโครงสร้างแบบนี้:
{
  "table-A-id": {
    "field-1-id": 100,
    "field-2-id": "Hello"
  },
  "table-B-id": {
    "field-3-id": 250
  }
}
```

ทุกฟังก์ชันใน Phase 8 รับ `ctx: DataContext` เพื่อ "ดึงค่า field จริงๆ ออกมาคำนวณ"

---

## ส่วนที่ 1: Formula Engine (`formula-engine.ts`)

### มันทำอะไร?

`evaluateFormula(node, ctx)` รับ FormulaNode (tree ของสูตร) แล้วคำนวณออกมาเป็นตัวเลขหรือ string

### FormulaNode คืออะไร?

สูตรใน project นี้ไม่ได้เก็บเป็น string เช่น `"A + B * C"` แต่เก็บเป็น **tree** (ต้นไม้ข้อมูล):

```
สูตร: (Price * Quantity) + Discount
จะถูกเก็บเป็น tree แบบนี้:

operation(+)
├── operation(*)
│   ├── field(ref: Price)
│   └── field(ref: Quantity)
└── literal(value: 50)  ← สมมติ Discount = 50
```

`evaluateFormula` จะ "ดำดิ่ง" ลงต้นไม้นี้แบบ recursive:

```typescript
// บรรทัด 18-46
export function evaluateFormula(node: FormulaNode, ctx: DataContext): number | string {
  switch (node.type) {
    case 'literal':
      return node.value           // ➜ คืนค่าตรงๆ เช่น 50

    case 'field':
      return resolveField(...)    // ➜ ดึงค่าจาก DataContext

    case 'percent':
      return evaluate(node.node) / 100  // ➜ คำนวณข้างในก่อน แล้วหาร 100

    case 'operation':
      const l = evaluate(node.left)     // ➜ คำนวณด้านซ้ายก่อน
      const r = evaluate(node.right)    // ➜ แล้วค่อยด้านขวา
      switch (node.op) {
        case '+': return l + r
        // ...
      }
  }
}
```

### Helper สำคัญ: `toNumber`

```typescript
// บรรทัด 5-10
export function toNumber(val: number | string, hint: string): number {
  if (typeof val === 'number') return val
  const n = Number(val)
  if (Number.isNaN(n)) throw new Error(`${hint} is not a number: "${val}"`)
  return n
}
```

**ทำไมไม่ใช้ `Number()` ตรงๆ?**

| วิธี | input | output | ปัญหา |
|------|-------|--------|--------|
| `Number("hello")` | `"hello"` | `NaN` | เงียบ ไม่มี error |
| `toNumber("hello", "Price")` | `"hello"` | ❌ throw | Error ชัดๆ ว่า "Price is not a number" |

ถ้าใช้ `Number()` เงียบๆ → NaN จะไหลไปคำนวณต่อ → ผลลัพธ์ทั้งหมดเป็น NaN → ผู้ใช้งงว่าเกิดอะไร

### Exhaustive Guard (Safety Net สำหรับอนาคต)

```typescript
// บรรทัด 39-42
default: {
  const exhausted: never = node.op
  throw new Error(`Unknown operator: ${exhausted}`)
}
```

TypeScript trick: ถ้าเพิ่ม operator ใหม่เข้า schema แต่ลืมเพิ่มใน switch → TypeScript จะ error ที่บรรทัดนี้ทันที ก่อน build เสร็จ ไม่มีทางหลุดไป production

---

## ส่วนที่ 2: Condition Evaluator (`condition-evaluator.ts`)

### มันทำอะไร?

`evaluateCondition(cond, ctx)` รับ Condition 1 ข้อ แล้วตอบ `true` หรือ `false`

### ตัวอย่าง Condition

```
Condition: Table1.Price > 100
Left:  FieldRef → ดึงค่าจาก DataContext → 250
Right: literal → 100
Operator: greater_than → 250 > 100 → true ✓
```

### การ Resolve Value

```typescript
// บรรทัด 8-15
function resolve(side, ctx) {
  if (isFieldRef(side)) {
    return ctx[side.tableId]?.[side.fieldId]  // ดึงจาก DataContext
  }
  return side  // ถ้าเป็น literal ก็คืนตรงๆ
}
```

ทั้ง left และ right ของ condition อาจเป็น:
- **FieldRef** → ต้องดึงค่าจาก DataContext
- **Literal** → ใช้ค่าที่ผู้ใช้พิมพ์มาเลย

### ตารางสรุป Operator

| Operator | ใช้ยังไง | ต้องเป็น number? |
|----------|----------|-----------------|
| `equal` | `l === r` | ไม่ (เปรียบ string ได้) |
| `not_equal` | `l !== r` | ไม่ |
| `greater_than` | `toNumber(l) > toNumber(r)` | ✅ ต้องแปลง |
| `less_than` | `toNumber(l) < toNumber(r)` | ✅ ต้องแปลง |
| `contains` | `String(l).includes(String(r))` | ไม่ (แปลงเป็น string) |

---

## ส่วนที่ 3: tRPC Evaluate Mutation (`formula.ts`)

### มันทำอะไร?

`formula.evaluate` คือ "ประตู" ที่รับการกด RUN จาก client แล้วส่งผลกลับ

```typescript
// บรรทัด 165-211
evaluate: publicProcedure
  .input(z.object({
    state: BuilderStateSchema,   // conditions, results ทั้งหมด
    context: DataContextSchema,  // ค่า mock ที่ผู้ใช้ตั้งไว้
  }))
  .mutation(({ input }) => {
    // 1. คำนวณทุก condition
    const conditions = state.conditions.map(cond => {
      try { return { passes: evaluateCondition(cond, context), ... } }
      catch (e) { return { error: e.message, passes: false, ... } }
    })

    // 2. คำนวณทุก formula
    const results = state.results.map(result => {
      try { return { value: evaluateFormula(result.expression, context), ... } }
      catch (e) { return { error: e.message, ... } }
    })

    return { conditions, results }
  })
```

**สำคัญมาก:** mutation นี้ไม่ไปแตะ database เลย — pure computation บน server
มีแค่ try/catch ต่อ item เพื่อให้ error ของ condition หนึ่งไม่ทำให้ทั้งหมด crash

---

## ส่วนที่ 4: BuilderShell (State Management)

### โครงสร้าง State สำหรับ Preview

```typescript
// บรรทัด 63-67
const [mockOverrides, setMockOverrides] = useState<DataContext>({})
const mockContext = useMemo(
  () => buildDefaultContext(state.tables, mockOverrides),
  [state.tables, mockOverrides],
)
```

**สองตัวนี้ต่างกันยังไง?**

| ตัวแปร | เก็บอะไร | เมื่อไหร่เปลี่ยน |
|--------|----------|----------------|
| `mockOverrides` | ค่าที่ **ผู้ใช้แก้เอง** เท่านั้น | เมื่อแก้ input ใน PreviewBox |
| `mockContext` | ค่า **รวม** (default + overrides) | ทุกครั้งที่ tables หรือ overrides เปลี่ยน |

**ทำไมต้องแยก?** เพราะถ้าเก็บ mockContext ทั้งก้อนใน state → เมื่อเพิ่ม field ใหม่ ระบบจะหาค่า default ให้ไม่ได้

### `buildDefaultContext` ทำงานยังไง?

```typescript
// บรรทัด 22-33
function buildDefaultContext(tables, existing): DataContext {
  tables.forEach((table, ti) => {
    table.fields.forEach((field, fi) => {
      const prev = existing[table.id]?.[field.id]
      ctx[table.id][field.id] =
        prev !== undefined
          ? prev              // ถ้าผู้ใช้เคยแก้แล้ว → ใช้ค่าเดิม
          : field.dataType === 'string'
            ? `sample_${fi + 1}`  // string field → "sample_1", "sample_2"
            : 1                    // number field → 1
    })
  })
}
```

**Logic:** ใช้ค่าที่ผู้ใช้แก้ถ้ามี, ไม่งั้น generate default ให้อัตโนมัติ

### Delta Callback Pattern

```typescript
// บรรทัด 101-106
onContextChange={(tableId, fieldId, value) =>
  setMockOverrides((prev) => ({
    ...prev,
    [tableId]: { ...prev[tableId], [fieldId]: value },
  }))
}
```

ส่งแค่ "สิ่งที่เปลี่ยน" ไม่ใช่ทั้ง context ทั้งก้อน

---

## ส่วนที่ 5: PreviewBox (UI แสดงผล)

### โครงสร้าง Component

```
PreviewBox
├── MockDataEditor      → input fields ให้ผู้ใช้แก้ค่า mock
├── ConditionResults    → แสดง ✓/✗ ของแต่ละ condition (หลัง RUN)
└── FormulaResults      → แสดงค่าของแต่ละ formula (หลัง RUN)
```

ทั้ง 3 เป็น **pure presentational components** — รับ props แล้ว render เท่านั้น ไม่มี local state

### MockDataEditor

- Loop สร้าง `<input>` ตามทุก field ใน tables
- เมื่อแก้ค่า → `handleChange` → `parseValue` (string → number ถ้าทำได้) → `onContextChange` delta

### ConditionResults

- รับ `conditions: ConditionResult[]` จาก RunResult
- แต่ละ item มี `passes: boolean` → แสดง `CheckCircle2` (เขียว) หรือ `XCircle` (แดง)
- ถ้ามี `error` → แสดง error message สีแดงต่อท้าย

### FormulaResults

- รับ `results: FormulaResult[]` จาก RunResult
- แต่ละ item มี `value` หรือ `error`
- `formatValue` แสดงตัวเลขสวยงาม: integer → ไม่มี decimal, float → 4 ตำแหน่งตัด trailing zeros

---

## Data Flow ตอนกด RUN (ครบทุกขั้นตอน)

```
1. ผู้ใช้กดปุ่ม RUN
   ↓
2. handleRun() → evaluate.mutate({ state, context: mockContext })
   [BuilderShell.tsx:74]
   ↓
3. tRPC ส่ง HTTP POST ไป /api/trpc/formula.evaluate
   ↓
4. Server: formula.evaluate mutation
   [formula.ts:165]
   ↓
5a. evaluateCondition(cond, context) ทีละ condition
    [condition-evaluator.ts:17]
5b. evaluateFormula(node, context) ทีละ result
    [formula-engine.ts:18]
   ↓
6. Server return { conditions: [...], results: [...] }
   ↓
7. onSuccess: setRunResult(data)
   [BuilderShell.tsx:71]
   ↓
8. runResult prop ส่งลงไป PreviewBox
   ↓
9. PreviewBox แสดงผลพร้อม fade-in animation
   [PreviewBox.tsx:192]
```

---

## Common Tasks — ทำอะไร แก้ไฟล์ไหน?

| ต้องการ... | แก้ที่... |
|-----------|----------|
| เพิ่ม operator ใหม่ เช่น `>=` | `src/types/index.ts` (เพิ่ม Operator type) + `condition-evaluator.ts:20` (เพิ่ม case) |
| เพิ่ม node type ใหม่ เช่น `abs` | `src/types/index.ts` (เพิ่ม FormulaNode type) + `formula-engine.ts:18` (เพิ่ม case) |
| เปลี่ยนวิธีแสดงผลตัวเลข | `PreviewBox.tsx:53` (`formatValue`) |
| เพิ่ม mock data default logic | `BuilderShell.tsx:22` (`buildDefaultContext`) |
| แก้ validation ของ RUN input | `formula.ts:165` (DataContextSchema หรือ input schema) |
| เพิ่ม condition result field | `PreviewBox.tsx:9` (ConditionResult interface) + `formula.ts:178` |

---

## สิ่งที่ต้องรู้ก่อนแก้โค้ด Phase 8

### 1. อย่าแตะ `toNumber` โดยไม่เข้าใจ

`toNumber` เป็น single source of truth สำหรับการแปลง string → number ที่ปลอดภัย
ถ้าต้องการแปลงตัวเลขในโค้ดใหม่ → **ใช้ toNumber เสมอ** ไม่ใช่ `Number()` หรือ `parseInt()`

### 2. Exhaustive Guard ต้องอยู่ครบ

ทุกครั้งที่เพิ่ม case ใน `FormulaNode` หรือ `Operator` type → ต้องเพิ่ม case ใน switch ด้วย
TypeScript จะ error ถ้าลืม (เพราะมี `default: { const x: never = ... }`)

### 3. อย่าแก้ `mockContext` โดยตรง

`mockContext` เป็น derived value (คำนวณมาจาก `mockOverrides`)
ถ้าต้องการเปลี่ยนค่า mock → `setMockOverrides` ด้วย delta เท่านั้น

### 4. evaluate mutation เป็น stateless

ไม่มีการ query database ใน evaluate — รับข้อมูลมา คำนวณ return ทันที
ถ้าจะเพิ่ม caching หรือ logging ต้องทำเป็น wrapper ชั้นนอก ไม่ใช่แก้ mutation โดยตรง

---

## Code Tour แบบ Interactive

project นี้มี CodeTour สำหรับ Phase 8 ที่เดิน step-by-step ผ่านทุกไฟล์:

```
.tours/new-joiner-phase8-formula-engine.tour
```

เปิดได้ด้วย VS Code extension: **CodeTour** (มาจาก Microsoft)
หรือดู tour file โดยตรงที่ `.tours/` folder

---

## Phase 9 จะทำอะไรต่อ?

| งาน | เครื่องมือ | ไฟล์ที่เกี่ยวข้อง |
|-----|----------|-----------------|
| Unit tests — formula engine | Vitest | `src/lib/formula-engine.test.ts` (ใหม่) |
| Unit tests — condition evaluator | Vitest | `src/lib/condition-evaluator.test.ts` (ใหม่) |
| E2E test — RUN flow | Playwright | `tests/e2e/run-flow.spec.ts` (ใหม่) |
| Undo/Redo | Zustand middleware | `src/store/builder-store.ts` |
| Responsive layout | Tailwind | ทุก panel component |
| Production build verify | Next.js | `npm run build` |

สิ่งที่ควรทดสอบเป็นพิเศษ:
- `evaluateFormula` กับ node ทุก type รวมถึง nested operations
- `evaluateCondition` กับ case ที่ field ไม่อยู่ใน context (error path)
- `buildDefaultContext` เมื่อ tables เปลี่ยน — ค่าเดิมต้องยังอยู่, field ใหม่ต้องได้ default

---

## คำสั่งที่ใช้บ่อยสำหรับ Phase 9

```bash
# Run dev server
npm run dev

# TypeScript check (ต้องผ่าน 0 errors)
npx tsc --noEmit

# Lint (ต้องผ่าน 0 errors)
npm run lint

# Unit tests (เพิ่มใน Phase 9)
npm run test
npx vitest run src/lib/formula-engine.test.ts

# E2E tests (เพิ่มใน Phase 9)
npm run test:e2e
```

---

*เขียนโดย Claude | Phase 8 Complete | 2026-05-21*  
*อ้างอิง: PLAN.md Phase 8 + post-mortem-phase-8.md*
