# ONBOARDING PHASE 7 — Result / Formula Panel

> สำหรับ Developer มือใหม่ที่เพิ่งเข้ามา และกำลังจะเริ่มต่อจาก Phase 7 เข้าสู่ Phase 8
> เขียนแบบชาวบ้านเข้าใจง่าย ไม่ใช่ academic paper

---

## ภาพรวมก่อนเลย — Phase 7 ทำอะไร?

ลองนึกถึง Excel ที่คุณใช้งาน เวลาคุณพิมพ์สูตรในช่อง cell เช่น `=A1 + B2 * 100` — นั่นคือสิ่งที่ Phase 7 ทำ แต่ทำแบบ **Drag & Drop ไม่ต้องพิมพ์ code**

ผู้ใช้สามารถ:
1. กด "Add Result" สร้างแถวใหม่
2. ตั้งชื่อ เช่น "Total Price"
3. ลาก Field จาก Table มาวางในช่อง
4. กดปุ่ม `+op` เพื่อเพิ่มเครื่องหมายคำนวณ เช่น `+`, `-`, `×`, `÷`
5. ได้สมการ visual แบบ `[Table1.Price] × [Table2.Qty]` โดยไม่เขียนโค้ดเลย

Phase 8 จะรับต่อและ **ประเมินค่าจริงๆ** จากข้อมูล

---

## โครงสร้างไฟล์ที่เกี่ยวข้อง

```
src/
├── lib/
│   └── schema.ts              ← นิยาม FormulaNode + Validation ทั้งหมด
├── components/builder/
│   └── ResultPanel.tsx        ← ทุกอย่างที่เห็นใน Result Panel
└── store/
    └── builder-store.ts       ← addResult / updateResult / removeResult
```

ไฟล์หลักมีแค่ 3 ไฟล์นี้ ถ้าบั๊กเกี่ยวกับ Result/Formula เกิดขึ้น — ดูที่นี่ก่อนเลย

---

## Concept หลัก 1: FormulaNode คืออะไร?

`FormulaNode` คือแนวคิดที่สำคัญที่สุดของ Phase 7 ทั้งหมด ถ้าเข้าใจตรงนี้ ที่เหลือตามมาเองหมด

### มันคือ "ต้นไม้สมการ"

ลองนึกว่าคุณต้องการคำนวณ `(ราคา + ภาษี) × จำนวน`

แทนที่จะเก็บเป็น string `"(price + tax) * qty"` ซึ่งต้อง parse ทีหลัง — เราเก็บเป็น **ต้นไม้ข้อมูล** แบบนี้:

```
operation(×)
├── operation(+)
│   ├── field: Table1.Price
│   └── field: Table1.Tax
└── field: Table2.Qty
```

ต้นไม้นี้เรียกว่า **AST (Abstract Syntax Tree)** — ฟังดูหรูแต่แค่หมายความว่า "เก็บสมการเป็นโครงสร้างข้อมูล ไม่ใช่ string"

### FormulaNode มี 4 ชนิด

| ชนิด | หมายถึง | ตัวอย่าง |
|------|----------|----------|
| `field` | ชี้ไปที่ Field ใน Table | `Table1.Price` |
| `literal` | ค่าตายตัวที่พิมพ์เอง | `100`, `"Hello"` |
| `operation` | การคำนวณ 2 ค่า | `A + B` |
| `percent` | ห่อค่าด้วย % | `(A + B) %` |

แต่ละชนิดสามารถมี "ลูก" ที่เป็น FormulaNode อีกอัน — ทำให้ tree ลึกได้หลายชั้น

### ดูโค้ดได้ที่ไหน?

```
src/lib/schema.ts บรรทัด 58
```

---

## Concept หลัก 2: NodePath — บอกทิศทางในต้นไม้

เมื่อผู้ใช้คลิก "เปลี่ยน operator" ที่ `+` เป็น `×` — โปรแกรมต้องรู้ว่าจะไปแก้ Node ตัวไหน ใน tree ที่อาจลึก 5-6 ชั้น

**NodePath** คือ array ที่บอกเส้นทาง เช่น:
- `[]` = Root node เอง
- `['left']` = ลูกซ้ายของ Root
- `['left', 'right']` = ลูกขวาของลูกซ้ายของ Root

ฟังก์ชัน `updateAtPath(root, path, newNode)` รับ path นี้ แล้วเดินลงไปในต้นไม้แบบ recursive จนถึงตำแหน่งที่ต้องการ แล้ว **return ต้นไม้ใหม่ทั้งก้อน** (ไม่แก้ของเดิม) — นี่คือ immutable update

### ทำไม Immutable?

เพราะ Zustand ตรวจจับ state change โดยเปรียบ reference ว่า "เหมือนเดิมไหม?" ถ้าแก้ in-place Zustand จะคิดว่าไม่มีอะไรเปลี่ยน → UI ไม่ re-render → ผู้ใช้กดปุ่มแล้วไม่เห็นผลอะไร

---

## Concept หลัก 3: Dispatcher Pattern

`ResultPanel.tsx` มี component หลัก 6 ตัว:

```
ResultPanel          ← หน้าจอทั้งหมด (exported)
└── ResultRow        ← แถวหนึ่งแถว (ชื่อ + สมการ + ปุ่มลบ)
    └── NodeEditor   ← "Dispatcher" — ดู type แล้วส่งต่อ
        ├── FieldNodeEditor     ← render field: DropZone + ปุ่ม
        ├── LiteralNodeEditor   ← render literal: input box
        ├── OperationNodeEditor ← render operation: left [op] right
        └── PercentNodeEditor   ← render percent: (node) %
```

**NodeEditor** แค่ทำ:
```tsx
if (node.type === 'field')      → <FieldNodeEditor ... />
if (node.type === 'literal')    → <LiteralNodeEditor ... />
if (node.type === 'operation')  → <OperationNodeEditor ... />
else                            → <PercentNodeEditor ... />
```

แค่นั้น! แต่เพราะ `OperationNodeEditor` เรียก `<NodeEditor>` กลับมา ทำให้ UI วาด tree ได้ลึกเท่าไรก็ได้

---

## Flow ตั้งแต่ผู้ใช้คลิกถึง Database

เมื่อผู้ใช้กด **"Add Result"**:

```
ResultPanel.handleAdd()
   ↓
useBuilderStore.addResult(newResult)
   ↓
Zustand state: results เพิ่ม 1 ตัว, isDirty = true
   ↓
use-auto-save.ts เฝ้าดู isDirty → debounce 500ms
   ↓
trpc.formula.upsert.mutate(BuilderState)
   ↓
Vercel Postgres บันทึก JSONB
```

เมื่อผู้ใช้ **ลาก Field มาวาง** ใน DropZone:

```
DropZone.onDrop(fieldRef)
   ↓
onUpdate(path, { type: 'field', ref: fieldRef })
   ↓
ResultRow.handleNodeUpdate(path, next)
   ↓
updateAtPath(result.expression, path, next) → ต้นไม้ใหม่
   ↓
useBuilderStore.updateResult(resultId, { expression: newTree })
   ↓
isDirty = true → auto-save
```

---

## สิ่งที่ Phase 7 แก้บั๊กไปแล้ว (อย่าทำซ้ำ!)

Phase 7 เจอบั๊กหลายตัวระหว่าง review อ่านรายละเอียดเต็มได้ที่ `docs/post-mortem-phase-7.md` สรุปสั้นๆ:

| อย่าทำ | ทำแบบนี้แทน |
|--------|------------|
| `e.target.value as FormulaOp` | `FormulaOpSchema.safeParse(e.target.value)` |
| `if (depth > 5)` hardcode | `UI_MAX_DEPTH = Math.min(8, BUILDER_LIMITS.FORMULA_DEPTH)` |
| `String(node.value)` ตรงๆ | `String(node.value ?? '')` ป้องกัน null/undefined |
| เพิ่ม `z.boolean()` ใน LiteralValueSchema | ไม่ต้อง — literal มีแค่ string กับ number |
| ฟังก์ชันยาว >50 บรรทัด | แยก sub-component ออกมา |

---

## ขีดจำกัดที่ต้องรู้

| ตัวแปร | ค่า | ความหมาย |
|--------|-----|----------|
| `UI_MAX_DEPTH` | 8 | ความลึกสูงสุดของ tree ที่ UI อนุญาต |
| `BUILDER_LIMITS.FORMULA_DEPTH` | 20 | ความลึกสูงสุดที่ schema ยอมรับ |
| `BUILDER_LIMITS.STR_NAME` | 200 | ชื่อ Result ยาวสูงสุด 200 ตัว |
| `BUILDER_LIMITS.RESULTS` | 50 | Result ได้สูงสุด 50 แถวต่อ Formula |

---

## คำถามที่มักถามบ่อย

**Q: ทำไม UI_MAX_DEPTH = 8 แต่ Schema allow ถึง 20?**
A: เพราะถ้า tree ลึก 15-20 ชั้น หน้าจอจะล้น อ่านไม่รู้เรื่อง เลยกำหนด UI cap ที่ 8 แต่ถ้าข้อมูลเก่าที่ลึกกว่านั้นโหลดมา schema ยังรับได้ — แค่ UI ไม่ให้สร้างใหม่ลึกขึ้นไปอีก

**Q: ถ้า result ถูกลบ ข้อมูลหายหรือเปล่า?**
A: ลบจาก Zustand store ทันที แล้ว auto-save overwrite ลง DB — ไม่มี soft delete ใน Phase 7 (Phase 9 ค่อยพิจารณา undo/redo)

**Q: FormulaNode เก็บใน DB ยังไง?**
A: เก็บเป็น JSONB ใน Postgres — Prisma serialize/deserialize ให้อัตโนมัติ ไม่ต้อง convert เอง แต่ต้อง validate ด้วย `ResultFormulaSchema` ก่อนบันทึกเสมอ

**Q: DropZone มาจากไหน?**
A: สร้างใน Phase 5 (`src/components/dnd/DropZone.tsx`) เป็น reusable component ที่รับ FieldRef ผ่าน @dnd-kit ไม่ต้องแก้อะไรใน Phase 7

---

## เตรียมตัวสำหรับ Phase 8

Phase 8 จะเพิ่ม:

1. **`src/lib/formula-engine.ts`** — ฟังก์ชัน `evaluate(node: FormulaNode, context: DataContext): number | string`
   - รับ FormulaNode tree จาก Zustand
   - รับ DataContext ที่มีค่าจริงของแต่ละ Field เช่น `{ 'Table1.Price': 100, 'Table2.Qty': 5 }`
   - เดิน traverse tree แบบ recursive แล้วคำนวณออกมา

2. **`src/lib/condition-evaluator.ts`** — evaluate Condition list

3. **tRPC endpoint `formula.evaluate`** — รับ BuilderState + data → return results

4. **`src/components/builder/PreviewBox.tsx`** — แสดงผลลัพธ์หลังกด RUN

**สิ่งที่ต้องเข้าใจก่อนเริ่ม Phase 8:**
- อ่าน FormulaNode type ใน `schema.ts` ให้ขึ้นใจ
- เข้าใจว่า `operation` node มี `left` และ `right` ที่เป็น FormulaNode อีกอัน
- เข้าใจ recursive traversal — ฝึก trace โค้ด `updateAtPath` ด้วยมือก่อน
- อ่าน `PLAN.md` Phase 8 เพื่อเข้าใจ scope ทั้งหมด

---

## Code Tour

มี Code Tour ไว้ walk-through ทีละขั้นได้ที่:
```
.tours/new-joiner-phase7-result-panel.tour
```

เปิดใน VS Code ด้วย Extension **CodeTour** แล้วกด Play ได้เลย — จะพาเดินผ่านทุก component พร้อม comment ภาษาชาวบ้านครบ

---

## ไฟล์อ้างอิง Phase 7

| ไฟล์ | บรรทัดสำคัญ | ดูอะไร |
|------|------------|--------|
| `src/lib/schema.ts` | 58 | FormulaNode type |
| `src/lib/schema.ts` | 47 | FormulaOpSchema |
| `src/lib/schema.ts` | 5 | BUILDER_LIMITS |
| `src/components/builder/ResultPanel.tsx` | 36 | updateAtPath |
| `src/components/builder/ResultPanel.tsx` | 255 | NodeEditor dispatcher |
| `src/components/builder/ResultPanel.tsx` | 316 | ResultPanel export |
| `src/store/builder-store.ts` | 34 | addResult / updateResult |
| `docs/post-mortem-phase-7.md` | ทั้งไฟล์ | บั๊กที่เคยเจอ + บทเรียน |

---

> เขียนโดย Kru Dew — อัปเดตหลัง Phase 7 เสร็จสิ้น (21 พ.ค. 2026)
