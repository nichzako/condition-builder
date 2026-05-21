# Onboarding Guide — Phase 5: Drag & Drop Foundation

> สำหรับ Developer ที่เพิ่งเข้าร่วมโปรเจกต์ หรืออยากเข้าใจว่าระบบ drag & drop ทำงานยังไงก่อนเริ่ม Phase 6

---

## ภาพรวมในหนึ่งประโยค

Phase 5 ติดตั้งระบบลาก-วาง field ระหว่าง panel โดยที่ panel แต่ละตัวไม่ต้องรู้จักกัน — ทุกอย่างผ่าน "สมองกลาง" ที่ชื่อ `BuilderDndContext`

---

## ทำไมต้องมี DndContext?

ก่อนจะมี Phase 5 FieldPanel รู้แค่ว่า "ฉันมี field อะไรบ้าง" แต่ไม่รู้จะส่งไปให้ ConditionPanel หรือ ResultPanel ได้ยังไง

**ปัญหาหลัก:** component ที่ drag (FieldPanel) กับ component ที่รับ drop (ConditionPanel) ไม่ได้เป็น parent-child กัน — ส่ง props ตรงๆ ไม่ได้

**วิธีแก้ของ @dnd-kit:** ใช้ `DndContext` ครอบทั้งสอง แล้วให้ library จัดการ event ให้ เราแค่บอกว่า "ตัวนี้ลากได้" และ "ตัวนี้รับได้"

```
┌─────────────────────────────────┐
│     BuilderDndContext           │  ← รู้ว่ากำลังลากอะไร และจะไปที่ไหน
│  ┌──────────────────────────┐   │
│  │  FieldPanel              │   │
│  │  └── DraggableField ──►  │   │  ← บอกว่า "ฉันลากได้"
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  ConditionPanel          │   │
│  │  └── DropZone        ◄── │   │  ← บอกว่า "ฉันรับได้"
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

---

## 3 ไฟล์หลัก — แต่ละตัวทำอะไร?

### 1. `DraggableField.tsx` — ทำให้ chip ลากได้

```tsx
<DraggableField fieldRef={{ tableId, fieldId, label: 'Table 1.Revenue' }}>
  <FieldChip field={field} onRemove={...} />
</DraggableField>
```

**ทำอะไร:** ครอบ children ด้วย div ที่มี event handlers ของ @dnd-kit ทำให้ pointer drag ได้

**สิ่งที่ติดไปกับของที่ลาก:** `fieldRef` (tableId + fieldId + label) — ข้อมูลนี้จะถูกส่งต่อไปหา DropZone ตอนวาง

**cursor:** `cursor-grab` ตอนปกติ / `cursor-grabbing` ตอนกำลังลาก / `opacity-40` เพื่อบอกว่า item กำลังถูกยกออกไป

---

### 2. `DropZone.tsx` — ช่องรับของที่ลาก

```tsx
<DropZone
  id="condition-1-left"
  currentValue={condition.left}   // FieldRef ที่วางอยู่แล้ว (ถ้ามี)
  onDrop={(fieldRef) => updateCondition(id, { left: fieldRef })}
  placeholder="Drop field here"
/>
```

**ทำอะไร:** แสดง UI 3 state และจัดการรับ drop

| State | ลักษณะ | เมื่อ |
|-------|--------|-------|
| ว่าง | dashed border สีเทา | ยังไม่มีค่า |
| มีค่า | ดูเหมือน chip ปกติ | วางแล้ว |
| isOver | border ฟ้า พื้นหลังฟ้าอ่อน | ของกำลังลอยอยู่เหนือ |

**สิ่งสำคัญ:** `DropZone` ลงทะเบียน `onDrop` callback ให้ BuilderDndContext อัตโนมัติ — Phase 6 แค่ render `<DropZone>` แล้วใส่ `onDrop` ก็พอ

---

### 3. `BuilderDndContext.tsx` — สมองกลาง

นี่คือส่วนที่ซับซ้อนที่สุด แต่ก็เป็นส่วนที่คนอื่นต้องรู้น้อยที่สุด

**มี 4 ส่วนหลัก:**

#### ก. Handler Registry (สมุดโทรศัพท์)

```tsx
const handlers = useRef(new Map<string, DropHandler>())
```

เป็น Map ที่เก็บว่า "slot id นี้ → เรียก function นี้เมื่อมีของถูกวาง"

DropZone แต่ละตัว **ลงทะเบียนตัวเองตอน mount** และ **ยกเลิกตอน unmount** อัตโนมัติ

#### ข. DragGhost (chip ผีที่ลอยตาม cursor)

```tsx
<DragOverlay dropAnimation={null}>
  {activeFieldRef ? <DragGhost fieldRef={activeFieldRef} /> : null}
</DragOverlay>
```

pill สีดำที่แสดงชื่อ field ขณะ drag — render เป็น portal ไปที่ `document.body` โดย @dnd-kit

#### ค. onDragStart / onDragEnd

```
ผู้ใช้กด pointer ↓
    ↓ เลื่อน > 8px
onDragStart → บันทึก activeFieldRef → แสดง ghost chip

ผู้ใช้ปล่อย pointer ↑
    ↓
onDragEnd → เคลียร์ ghost → หา slot ที่รับ → เรียก handler
```

#### ง. isFieldRef (type guard)

```tsx
function isFieldRef(value: unknown): value is FieldRef {
  return typeof value === 'object' && value !== null
    && typeof value.tableId === 'string'
    && typeof value.fieldId === 'string'
    && typeof value.label === 'string'
}
```

ป้องกันไม่ให้ข้อมูลผิดรูปแบบเข้าไปสร้างความเสียหาย

---

## Handler Registry คืออะไร — อธิบายแบบชาวบ้าน

ลองคิดว่าตึกมีพนักงานรับพัสดุ (BuilderDndContext)

- แต่ละห้อง (DropZone) บอกพนักงานว่า "ถ้ามีพัสดุส่งมาที่ห้อง 101 โทรหาฉันนะ"
- ตอนส่งพัสดุ (drag & drop) พนักงานดูที่อยู่ปลายทาง (`over.id`) แล้วโทรหาคนในห้องนั้น
- ถ้าห้องนั้น checkout ไปแล้ว (component unmount) ชื่อก็ถูกลบออกจากสมุด

```tsx
// DropZone ลงทะเบียนตัวเองผ่าน useDndDropHandler
useDndDropHandler('condition-1-left', (fieldRef) => {
  updateCondition(id, { left: fieldRef })
})

// BuilderDndContext ตอน drop:
handlers.current.get('condition-1-left')?.(droppedFieldRef)
// → เรียก updateCondition อัตโนมัติ
```

---

## Flow ครบวงจร: ตั้งแต่ลากจนวาง

```
1. ผู้ใช้กด pointer ค้างที่ chip "Revenue"
         ↓ (เลื่อน > 8px)
2. onDragStart ถูกเรียก
   - activeFieldRef = { tableId, fieldId, label: "Table 1.Revenue" }
   - DragGhost ปรากฏลอยตาม cursor

3. ผู้ใช้ลากไปเหนือ DropZone ของ Condition Left
   - isOver = true → DropZone เปลี่ยนสีเป็นฟ้า

4. ผู้ใช้ปล่อย pointer
         ↓
5. onDragEnd ถูกเรียก
   - activeFieldRef = null (ghost หาย)
   - over.id = "condition-1-left"
   - handlers.get("condition-1-left")(fieldRef)
         ↓
6. updateCondition({ left: { tableId, fieldId, label } })
   - Zustand store อัปเดต
   - Auto-save ทำงาน → tRPC mutation
   - DropZone แสดง "Table 1.Revenue" แทน placeholder
```

---

## วิธีใช้ใน Phase 6 (ConditionPanel)

Phase 6 ไม่ต้องแตะ `BuilderDndContext`, `DraggableField` เลย แค่ใช้ `<DropZone>`:

```tsx
// src/components/builder/ConditionPanel.tsx (Phase 6)
import { DropZone } from '@/components/dnd/DropZone'
import { useBuilderStore } from '@/store/builder-store'

function ConditionRow({ condition }: { condition: Condition }) {
  const { updateCondition } = useBuilderStore()

  return (
    <div className="flex items-center gap-2">
      {/* Left field slot */}
      <DropZone
        id={`condition-${condition.id}-left`}
        currentValue={condition.left instanceof Object && 'tableId' in condition.left
          ? condition.left as FieldRef
          : null}
        onDrop={(fieldRef) => updateCondition(condition.id, { left: fieldRef })}
        placeholder="Left field"
      />

      {/* Operator dropdown — Phase 6 งาน */}

      {/* Right field slot */}
      <DropZone
        id={`condition-${condition.id}-right`}
        currentValue={...}
        onDrop={(fieldRef) => updateCondition(condition.id, { right: fieldRef })}
        placeholder="Right field"
      />
    </div>
  )
}
```

**สังเกต:** `id` ต้อง unique ทั้งแอป — ใช้ pattern `condition-{id}-left` / `condition-{id}-right`

---

## สิ่งที่ต้องระวัง (Gotchas)

### 1. DropZone id ต้อง unique ทั้งแอป

ถ้า 2 DropZone ใช้ id เดียวกัน จะมีแค่อันล่าสุดที่ลงทะเบียนได้ เพราะ Map เก็บได้ key ละ 1 ค่า

### 2. DraggableField id มี prefix `field:`

id ของ DraggableField = `field:${tableId}:${fieldId}` — prefix `field:` ป้องกันชนกับ slot id เช่น `condition-1-left`

### 3. onDrop ไม่ต้อง useCallback

`useDndDropHandler` จัดการ stale closure ให้แล้วด้วย `useRef` — ส่ง function ธรรมดาได้เลย

### 4. FieldRef label ไม่ auto-update ถ้า rename table

ถ้าผู้ใช้ rename "Table 1" เป็น "Sales" label ที่บันทึกไว้ใน Condition จะยังเป็น "Table 1.Revenue" — นี่เป็น known limitation ที่จะแก้ใน Phase 9

---

## ไฟล์ที่ต้องรู้จัก

| ไฟล์ | ทำอะไร |
|------|--------|
| `src/components/dnd/BuilderDndContext.tsx` | สมองกลาง + handler registry + ghost chip |
| `src/components/dnd/DraggableField.tsx` | wrapper ทำให้ chip ลากได้ |
| `src/components/dnd/DropZone.tsx` | ช่องรับ drop พร้อม visual states |
| `src/components/builder/BuilderShell.tsx` | ครอบทุก panel ด้วย BuilderDndContext |
| `src/components/builder/FieldPanel.tsx` | ใช้ DraggableField wrap field chips |
| `src/store/builder-store.ts` | `updateCondition`, `updateResult` actions |
| `src/lib/schema.ts` | Zod type ของ FieldRef, Condition |

---

## คำสั่ง Dev ที่ใช้บ่อย

```bash
# เปิด dev server
npm run dev

# ตรวจ type errors
npx tsc --noEmit

# ดู code tour แบบ interactive (ติดตั้ง CodeTour extension ใน VS Code)
# เปิด .tours/new-joiner-phase5-drag-drop.tour
```

---

*Phase ถัดไป: [Phase 6 — Condition Panel](../PLAN.md#phase-6--condition-panel)*
