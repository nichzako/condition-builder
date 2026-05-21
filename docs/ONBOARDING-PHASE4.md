# Onboarding Guide — Phase 4: Field Panel + Auto-save

> สำหรับ Developer มือใหม่ที่เพิ่งเข้าโปรเจกต์ หรืออยากเข้าใจ Phase 4 ก่อนลงมือทำ Phase 5
> อ่านจบภายใน 10 นาที แล้วจะเข้าใจว่าโค้ดทำงานยังไงทั้งระบบ

---

## 📌 Phase 4 ทำอะไร? (ภาพรวม 30 วินาที)

Phase 4 สร้าง **Field Panel** — แผงด้านบนสุดของ Builder ที่ให้ user:

- กด **"Add Field +"** เพิ่ม Table ใหม่
- คลิกชื่อ Table เพื่อ **เปลี่ยนชื่อ** inline
- กด **"+"** ใน Table card เพื่อ **เพิ่ม Field** ใหม่
- กด **"×"** เพื่อ **ลบ** Table หรือ Field
- ทุกการเปลี่ยนแปลง **บันทึกอัตโนมัติ** ภายใน 500ms

```
┌─────────────────────────────────────────────────────┐
│ Fields                              [Add Field +]    │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Table 1  +× │  │ Table 2  +× │                 │
│  │ Field A   × │  │ Price     × │                 │
│  │ Field B   × │  │ Qty       × │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## 🗺️ แผนที่ไฟล์ที่เกี่ยวข้อง

```
src/
├── lib/
│   └── schema.ts              ← พิมพ์เขียวข้อมูล (Zod schema)
├── types/
│   └── index.ts               ← TypeScript types (infer มาจาก Zod)
├── store/
│   └── builder-store.ts       ← คลังข้อมูลกลาง (Zustand)
├── hooks/
│   └── use-auto-save.ts       ← hook บันทึกอัตโนมัติ
└── components/builder/
    ├── BuilderShell.tsx        ← กรอบหน้าจอหลัก
    └── FieldPanel.tsx          ← ⭐ ไฟล์หลัก Phase 4
```

---

## 🔄 ข้อมูลไหลยังไง? (Data Flow)

```
user กดปุ่ม
     ↓
FieldPanel เรียก handler (handleAddTable / handleAddField ฯลฯ)
     ↓
handler เรียก store action (addTable / updateTable)
     ↓
Zustand store อัปเดต state + ตั้ง isDirty = true
     ↓
useAutoSave hook เห็น isDirty → รอ 500ms → ส่ง tRPC upsert
     ↓
Server บันทึกลง Database (Vercel Postgres)
     ↓
แสดง "Saved ✓" ในหัว Builder
```

**หัวใจสำคัญ:** FieldPanel ไม่รู้เรื่อง Database เลย — รู้แค่ Store และ handler ทำงานแยกกันสะอาด

---

## 📐 พิมพ์เขียวข้อมูล (Schema)

ก่อนดูโค้ด ต้องรู้ว่าข้อมูล "Field" และ "Table" หน้าตาเป็นยังไง:

```typescript
// Field หนึ่งตัว
type FieldDef = {
  id: string        // รหัสไม่ซ้ำ เช่น "abc-123"
  name: string      // ชื่อ เช่น "ราคา"
  dataType: 'number' | 'string' | 'boolean'
}

// Table หนึ่งก้อน
type TableSource = {
  id: string        // รหัสไม่ซ้ำ
  name: string      // ชื่อ เช่น "Table 1"
  type: 'table' | 'custom'
  fields: FieldDef[]  // ← array ของ Field ที่อยู่ใน Table นี้
}
```

**ไฟล์อ้างอิง:** `src/lib/schema.ts` บรรทัด 18–29

---

## 🗄️ Zustand Store — คลังข้อมูลกลาง

คิดว่า Store เหมือน **กล่องข้อมูลกลาง** ที่ทุก component ดึงไปใช้ได้

```typescript
// ใช้แค่นี้ใน FieldPanel
const { state, addTable, removeTable, updateTable } = useBuilderStore()

// state.tables คือ array ของ Table ทั้งหมด
// addTable(table)           → เพิ่ม Table ใหม่ + ตั้ง isDirty = true
// removeTable(tableId)      → ลบ Table + ตั้ง isDirty = true
// updateTable(id, changes)  → แก้ไข Table + ตั้ง isDirty = true
```

**กฎสำคัญ:** ทุก action จะตั้ง `isDirty = true` เสมอ — นี่คือสัญญาณให้ auto-save ทำงาน

**ไฟล์อ้างอิง:** `src/store/builder-store.ts` บรรทัด 41–70

---

## ⏱️ Auto-save ทำงานยังไง?

```
isDirty เปลี่ยนเป็น true
        ↓
useAutoSave hook เริ่มจับเวลา 500ms
        ↓
ถ้า user ทำอะไรอีก → reset นับใหม่ (debounce)
        ↓
500ms ผ่านโดยไม่มีการเปลี่ยนแปลง
        ↓
ส่ง tRPC mutation: formula.upsert({ state, name })
        ↓
Server บันทึก → แสดง "Saved"
```

**ข้อควรรู้:** ถ้ากำลัง save อยู่และ user แก้ไขอีก → รอให้ save ปัจจุบันเสร็จก่อน แล้วค่อย save รอบใหม่

**ไฟล์อ้างอิง:** `src/hooks/use-auto-save.ts`

---

## 🧩 Component Tree ของ FieldPanel

```
FieldPanel                     ← parent, ดึง store + สร้าง handlers
└── TableCard (×N)             ← Card แต่ละใบ, จัดการ addingField state
    ├── TableCardHeader        ← แถวบน: ชื่อ Table + ปุ่ม +×
    │   └── [inline input]     ← ปรากฏเมื่อคลิกชื่อ Table เพื่อ rename
    ├── FieldChip (×N)         ← แท็กแต่ละ Field, พร้อม drag Phase 5
    └── AddFieldRow            ← ช่อง input เพิ่ม Field (ปรากฏเมื่อกด +)
```

**หลักการแบ่ง state:**
| ข้อมูล | เก็บที่ไหน | เพราะอะไร |
|--------|-----------|-----------|
| tables, fields | Zustand store | ต้องบันทึกลง DB |
| กำลัง rename หรือเปล่า | `useState` ใน TableCardHeader | UI เท่านั้น |
| กำลังเพิ่ม field หรือเปล่า | `useState` ใน TableCard | UI เท่านั้น |

---

## 🔑 5 จุดสำคัญที่ต้องเข้าใจ

### 1. ตั้งชื่อ Table ไม่ให้ชนกัน

```typescript
// ไม่ใช้แบบนี้ (ลบแล้วเพิ่มใหม่ → ได้ชื่อซ้ำ)
name: `Table ${state.tables.length + 1}`

// ใช้แบบนี้แทน (หาเลขสูงสุดที่มีอยู่ แล้วบวก 1)
function nextTableName(tables) {
  const maxNum = tables.reduce((max, t) => {
    const match = /^Table (\d+)$/.exec(t.name)
    return match ? Math.max(max, parseInt(match[1])) : max
  }, 0)
  return `Table ${maxNum + 1}`
}
```

**ไฟล์:** `src/components/builder/FieldPanel.tsx` บรรทัด 208

---

### 2. Guard ป้องกัน Double Submit

```typescript
const submittedRef = useRef(false)  // flag ว่าส่งแล้วหรือยัง

const submit = () => {
  if (submittedRef.current) return  // ถ้าส่งแล้วไม่ทำซ้ำ
  submittedRef.current = true
  // ...ส่งข้อมูล
}
```

ทำไมต้องทำ? เพราะ input มีทั้ง `onKeyDown` (กด Enter) และ `onBlur` (คลิกออก) — ถ้าไม่มี guard อาจ add field 2 ครั้ง

**ไฟล์:** `src/components/builder/FieldPanel.tsx` บรรทัด 48–60

---

### 3. Sync ชื่อ Table แต่ไม่รีเซ็ตขณะ Edit

```typescript
useEffect(() => {
  if (!editingName) setNameValue(table.name)  // ← สำคัญมาก!
}, [table.name, editingName])
```

เงื่อนไข `!editingName` ป้องกันไม่ให้ชื่อที่กำลังพิมพ์อยู่ถูกรีเซ็ตทันที ถ้า store อัปเดตพร้อมกัน

**ไฟล์:** `src/components/builder/FieldPanel.tsx` บรรทัด 97–100

---

### 4. FieldChip เตรียมรองรับ Drag Phase 5 ไว้แล้ว

```tsx
<div
  data-field-id={field.id}  // ← Phase 5 DraggableField อ่าน attribute นี้
  className="... group ..."
>
```

Phase 5 จะ wrap component นี้ด้วย `useDraggable` จาก `@dnd-kit/core` — ไม่ต้องแก้ไขโค้ดใน FieldChip มาก

**ไฟล์:** `src/components/builder/FieldPanel.tsx` บรรทัด 17–35

---

### 5. maxLength ป้องกัน Input ยาวเกิน

```tsx
<input maxLength={FIELD_NAME_MAX_LENGTH} ... />
// FIELD_NAME_MAX_LENGTH = 200 (ตรงกับ Zod STR_NAME limit)
```

Server มี Zod validate อยู่แล้ว แต่ถ้าไม่มี maxLength บน input → user พิมพ์ยาว 10,000 ตัวอักษร แล้วค่อยถูก reject ที่ server ซึ่งแย่กว่า

**ไฟล์:** `src/components/builder/FieldPanel.tsx` บรรทัด 8, 67, 116

---

## 🛠️ Common Tasks — ทำอะไร แก้ที่ไหน?

| อยากทำอะไร | แก้ไฟล์ไหน | บรรทัดประมาณ |
|-----------|-----------|--------------|
| เพิ่มปุ่มใน Table card | `TableCardHeader` | 139–156 |
| เปลี่ยน default dataType ของ Field ใหม่ | `handleAddField` | 231–235 |
| เพิ่ม field type selector | `AddFieldRow` + `handleAddField` | 44–80 |
| เพิ่ม animation ตอน card เข้า/ออก | `FieldPanel` render section | 272–283 |
| เปลี่ยนขนาด card | `TableCard` className `w-44` | 175 |
| ทดสอบ auto-save | `use-auto-save.ts` | 51–77 |

---

## ⚠️ Gotchas ที่มือใหม่มักสับสน

**1. ทำไม Field ใหม่ถึง dataType เป็น 'number' ทุกตัว?**
เป็น default ของ Phase 4 — Phase 4 ยังไม่มี UI เลือก type จะทำใน Phase ถัดไป

**2. ทำไมต้องมี `submittedRef` แยกกับ `useState`?**
`useRef` ไม่ trigger re-render เหมาะสำหรับ flag ที่ต้องการความเร็ว `useState` trigger re-render ซึ่งไม่จำเป็นในกรณีนี้

**3. Auto-save ทำไมถึงบางครั้งช้า?**
มี debounce 500ms และรอให้ request ก่อนหน้าเสร็จก่อน ถ้าพิมพ์เร็วมาก อาจรอถึง 1–2 วินาทีกว่าจะ save

**4. ทำไม state ใน Store ไม่ persistent ข้าม refresh?**
Store ไม่ใช้ localStorage — ถ้า refresh browser จะโหลดจาก DB ใหม่ผ่าน tRPC `formula.get`

---

## 🚀 Phase 5 จะต่อยอดอะไร?

Phase 5 ทำ Drag & Drop — FieldChip ที่สร้างไว้ใน Phase 4 จะถูก wrap ด้วย `@dnd-kit/core`:

```
Phase 4 (เสร็จแล้ว)     Phase 5 (ถัดไป)
─────────────────        ────────────────────
FieldChip               DraggableField
  └─ แสดง chip             └─ wrap FieldChip ด้วย useDraggable()
                              └─ ส่ง FieldRef payload ตอน drop

ConditionPanel (placeholder)   DropZone
                              └─ รับ FieldRef จาก drop
                              └─ อัปเดต condition.left หรือ .right
```

**ไฟล์ที่จะสร้างใหม่ใน Phase 5:**
- `src/components/dnd/DraggableField.tsx`
- `src/components/dnd/DropZone.tsx`

---

## 📋 Quick Reference

```bash
# รัน dev server
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build

# เปิด DB browser
npx prisma studio
```

**URL สำหรับทดสอบ Phase 4:**
```
http://localhost:3000/builder
```

กด "Add Field +" → เพิ่ม Field → รอ 1 วินาที → เห็น "Saved" ในหัว = Phase 4 ทำงานถูกต้อง
