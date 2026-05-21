# Post-mortem: Phase 8 — Formula Engine + RUN

> เขียนหลัง fix ครบทุกตัว | ภาษาชาวบ้าน เข้าใจง่าย | ใช้ทบทวนก่อนทำ Phase ถัดไป

---

## ภาพรวม

Phase 8 เพิ่ม 3 ส่วนใหม่เข้า project:

1. **Formula Engine** — คำนวณ FormulaNode (AST) ให้ได้ตัวเลขจริง
2. **Condition Evaluator** — เช็คว่าเงื่อนไข (เช่น A > B) เป็น true/false
3. **PreviewBox + RUN** — ปุ่ม RUN ส่งข้อมูลไป server แล้วแสดงผล

พบ Bug ทั้งหมด **5 ตัว** (WR-01 ถึง WR-04 + M-1) และ **Design Gap 5 ตัว** (FD-1 ถึง FD-5)

---

## Bug 1 — WR-01: สวิตช์ที่ไม่มีเคส "อื่นๆ" (Missing Exhaustive Guard)

### เกิดอะไรขึ้น

ฟังก์ชัน `evaluateFormula` ใน `formula-engine.ts` มี `switch` ซ้อน `switch` สำหรับคำนวณ `+`, `-`, `*`, `/`, `%`

แต่ switch วงในไม่มี `default` case — ถ้าวันหนึ่งมีคนเพิ่ม operator ใหม่ (เช่น `**` สำหรับยกกำลัง) โค้ดจะ**ไม่ throw error** แต่จะ return `undefined` เงียบๆ แล้วผลลัพธ์จะกลายเป็น `NaN` ที่ไหนสักที่โดยไม่รู้สาเหตุ

### เปรียบเหมือน

เหมือนพนักงานรับออร์เดอร์ที่รู้เมนู 5 อย่าง แต่ถ้าลูกค้าสั่งเมนูที่ 6 เขาจะยิ้มพยักหน้าแล้วเดินหายไป โดยไม่บอกว่าไม่รู้จักเมนูนี้ และไม่ได้ทำอาหารมาให้เลย ลูกค้านั่งรอจนหิว

### ทำไมถึงเกิด

TypeScript สามารถตรวจสอบได้ว่าเรา handle ครบทุก case ใน union type — แต่ต้องมี `default: { const x: never = node.op }` ไว้บอก TypeScript ว่า "ถ้าถึงตรงนี้แปลว่า impossible แล้ว"

ตอนเขียนแรก ข้ามส่วนนี้ไป เพราะโค้ดดูครบแล้ว runtime ไม่พัง แต่ถ้า schema เพิ่ม operator ใหม่ในอนาคต TypeScript จะไม่เตือน

### แก้ยังไง

```typescript
// เพิ่ม default case ที่ TypeScript จะ error ถ้า node.op มีค่าใหม่
default: {
  const exhausted: never = node.op
  throw new Error(`Unsupported operator: ${exhausted}`)
}
```

### เรียนรู้อะไร

> **กฎ:** ทุก `switch` บน discriminated union ต้องมี `default: { const x: never = value }` เสมอ  
> มันเหมือนประกันภัย — วันนี้อาจไม่ได้ใช้ แต่ถ้าวันหนึ่งเกิดขึ้น จะรู้ทันที

---

## Bug 2 — WR-02: การแปลงตัวเลขที่เงียบเกินไป (Silent NaN Coercion)

### เกิดอะไรขึ้น

ใน `condition-evaluator.ts` สำหรับ operator `greater_than` และ `less_than` ใช้ `Number(l) > Number(r)` ตรงๆ

ปัญหา: `Number("hello")` ได้ `NaN` และ `NaN > 5` ได้ `false` — โดย**ไม่มี error เลย**

เช่น ถ้า field A มีค่าเป็น string `"hello"` แล้วเปรียบกับ `5` เงื่อนไขจะแสดง ✗ เงียบๆ โดยไม่บอกว่าเกิดอะไรขึ้น ผู้ใช้งานจะงงว่าทำไม condition ถึง fail

### เปรียบเหมือน

เหมือนชั่งน้ำหนักที่เอากล้วยขึ้นชั่ง แล้วเครื่องแสดง 0 kg เงียบๆ แทนที่จะบอกว่า "ต้องใส่ของที่ชั่งได้เท่านั้น"

### ทำไมถึงเกิด

`Number()` ใน JavaScript เป็น "silent coercion" — ถ้าแปลงไม่ได้จะได้ `NaN` แทน error

ส่วน `formula-engine.ts` มี helper `toNumber()` ที่ throw error ถ้าเจอ NaN อยู่แล้ว แต่ตอนเขียน `condition-evaluator.ts` ลืมไปว่ามีตัวนี้อยู่ เลยเขียน `Number()` ซ้ำขึ้นมาใหม่

### แก้ยังไง

Export `toNumber` จาก `formula-engine.ts` แล้ว import มาใช้:

```typescript
// formula-engine.ts
export function toNumber(val: number | string, hint: string): number {
  if (typeof val === 'number') return val
  const n = Number(val)
  if (Number.isNaN(n)) throw new Error(`${hint} is not a number: "${val}"`)
  return n
}

// condition-evaluator.ts (แก้แล้ว)
import { toNumber, type DataContext } from '@/lib/formula-engine'
case 'greater_than': return toNumber(l, 'left operand') > toNumber(r, 'right operand')
```

ตอนนี้ถ้า field เป็น string "hello" จะ throw error ที่อ่านเข้าใจได้: `"left operand is not a number: 'hello'"` และ PreviewBox จะแสดง error นั้นให้ผู้ใช้เห็น

### เรียนรู้อะไร

> **กฎ:** อย่าใช้ `Number()` ตรงๆ ในโค้ด production  
> ถ้าต้องการแปลง string เป็น number ให้ใช้ helper ที่ throw error ชัดเจน  
> และถ้ามี helper อยู่แล้วในโปรเจกต์ ให้ใช้อันเดิม — อย่าเขียนใหม่

---

## Bug 3 — WR-03: Mock Context ที่ "บวก default ทับ override" (Stale Context Problem)

### เกิดอะไรขึ้น

นี่คือ bug ที่ซับซ้อนที่สุดใน Phase 8

**ระบบ mock data ทำงานแบบนี้:**
1. `buildDefaultContext` — สร้างค่า default ให้ทุก field (เช่น `sample_1`, `1`)
2. ผู้ใช้แก้ค่าใน input → ค่านั้นควรถูกจำไว้ใน `mockOverrides`
3. `mockContext` = merge ของ (default + overrides)

**bug:** ตอน `onContextChange` ถูกเรียก มันส่ง `mockContext` ทั้งก้อน (ที่มีทั้ง default + override รวมกันแล้ว) กลับไปเก็บใน `mockOverrides`

ผลคือ: ค่า default ทั้งหมดถูก "บันทึกลง override" ไปด้วย

**ปัญหาที่เกิด:**
เมื่อผู้ใช้เพิ่ม field ใหม่หลังจากแก้ค่าไปแล้ว field ใหม่นั้นจะไม่ได้ค่า default ที่สดใหม่ — เพราะ `buildDefaultContext` เจอค่าเดิมใน override (ที่มันบันทึกไว้แบบผิดๆ) แล้วคิดว่า "มีอยู่แล้ว ไม่ต้อง default"

### เปรียบเหมือน

เหมือนโน้ตบุ๊กที่จด "ค่าที่ผู้ใช้เปลี่ยน" แต่ดันจดทั้งหน้าต่างๆ รวมถึงค่าที่ระบบเติมให้อยู่แล้วไปด้วย

ครั้งต่อไปที่เพิ่มหน้าใหม่ ระบบก็เปิดโน้ตบุ๊กดูแล้วพบว่า "โอ้ มีค่าแล้ว" ก็เลยไม่เติมค่า default ให้ — ทั้งที่จริงๆ ค่านั้นมาจากระบบ ไม่ใช่จากผู้ใช้

### ทำไมถึงเกิด

ปัญหามาจาก React pattern ที่ไม่ถูกต้อง — ใช้ `useEffect` เพื่อ sync state จาก state อีกอัน:

```typescript
// ❌ โค้ดเดิมที่มีปัญหา (ก่อน fix)
useEffect(() => {
  setMockContext(buildDefaultContext(state.tables, mockOverrides))
}, [state.tables, mockOverrides])
```

แล้ว `onContextChange` ส่ง `mockContext` ทั้งก้อนกลับ:
```typescript
// ❌ เขียนทับทั้งก้อน — เอา derived value ไปเก็บใน raw store
onContextChange={(newCtx) => setMockOverrides(newCtx)}
```

### แก้ยังไง

แยก concerns ออกจากกัน:

```typescript
// ✅ แก้แล้ว — ใช้ useMemo แทน useEffect
const [mockOverrides, setMockOverrides] = useState<DataContext>({})
const mockContext = useMemo(
  () => buildDefaultContext(state.tables, mockOverrides),
  [state.tables, mockOverrides],
)

// และ onContextChange ส่งแค่ delta (tableId, fieldId, value) ไม่ใช่ทั้งก้อน
onContextChange={(tableId, fieldId, value) =>
  setMockOverrides((prev) => ({
    ...prev,
    [tableId]: { ...prev[tableId], [fieldId]: value },
  }))
}
```

ตอนนี้ `mockOverrides` เก็บเฉพาะสิ่งที่ผู้ใช้แก้จริงๆ ค่า default ไม่มีทางปนเข้ามาได้

### เรียนรู้อะไร

> **กฎ:** ถ้า state B เป็นแค่การคำนวณจาก state A ให้ใช้ `useMemo` ไม่ใช่ `useEffect + setState`
>
> `useEffect` + `setState` = "ทำงานสองรอบ" (render ครั้งแรก → effect → setState → render อีกครั้ง)  
> `useMemo` = "คำนวณระหว่าง render เลย ไม่มีรอบพิเศษ"
>
> **สัญญาณเตือน:** ถ้าเห็น `useEffect` ที่ทำแค่ `setSomething(computeFrom(otherState))` — นั่นคือสัญญาณว่าควรเปลี่ยนเป็น `useMemo`

---

## Bug 4 — WR-04: ฟังก์ชันที่ชื่อโกหก (Misleading Function Name + Wrong Scope)

### เกิดอะไรขึ้น

ใน `formula.ts` router มีฟังก์ชันชื่อ `requireValidState()` ที่ถูกเรียกใช้ใน mutation หลายตัว — `addTable`, `addCondition`, และ `addResult`

ฟังก์ชันนี้ทำอะไร? มัน re-parse BuilderState ผ่าน `safeParseBuilderState` เพื่อเช็ค **ความลึกของ FormulaNode** (formula ซ้อนกันเกิน limit ไหม)

ปัญหา:
1. **ชื่อโกหก** — `requireValidState` ฟังดูเหมือนเช็ค "ความ valid ทั่วไป" แต่จริงๆ เช็คแค่ formula depth
2. **เรียกผิดที่** — `addTable` และ `addCondition` ไม่ได้เพิ่ม ResultFormula เลย การเช็ค formula depth ใน mutation พวกนี้เป็น no-op ทุกครั้ง — ทำงานเปล่า
3. **ทำให้สับสน** — คนอ่านโค้ดจะงงว่าทำไม addTable ต้องเช็ค formula depth

### เปรียบเหมือน

เหมือนร้านอาหารที่ทุกครั้งลูกค้าสั่งน้ำเปล่า พนักงานจะถามว่า "มีอาหารแพ้ไหม?" — ไม่ใช่ว่าผิด แต่คำถามนี้ควรถามแค่ตอนสั่งอาหารจริงๆ ไม่ใช่น้ำเปล่า

### แก้ยังไง

```typescript
// ❌ เดิม — ชื่อกว้างเกิน, เรียกใน addTable และ addCondition ด้วย
function requireValidState(updated) { ... }

// ✅ แก้แล้ว — ชื่อบอกชัดว่าเช็คอะไร, เรียกแค่ใน addResult
function enforceFormulaDepthLimit(updated) { ... }
// ใช้เฉพาะตอน addResult เท่านั้น
```

### เรียนรู้อะไร

> **กฎ:** ชื่อฟังก์ชันต้องบอกได้ว่าเช็คอะไรกันแน่ ไม่ใช่แค่ "valid" หรือ "check"  
> และควรเรียกฟังก์ชัน guard เฉพาะในที่ที่มันมีความหมาย
>
> ชื่อที่ดี = อ่านแล้วรู้เลยว่าถ้า fail จะเกิดอะไร  
> `enforceFormulaDepthLimit` → ถ้า fail = formula ลึกเกิน limit ✅  
> `requireValidState` → ถ้า fail = ??? ❌

---

## Bug 5 — M-1: setState ใน useEffect Body (ESLint Rule Violation)

### เกิดอะไรขึ้น

นี่คือ bug แรกที่เจอใน Phase 8 — ESLint reject ตอนเขียนโค้ดแรกใน `BuilderShell.tsx`

โค้ดเดิมใช้ `useEffect` เพื่อ sync `mockContext`:

```typescript
// ❌ ESLint error: react-hooks/set-state-in-effect
useEffect(() => {
  setMockContext(buildDefaultContext(state.tables, mockOverrides))
}, [state.tables, mockOverrides])
```

ESLint rule `react-hooks/set-state-in-effect` block pattern นี้ เพราะมันทำให้เกิด **unnecessary re-render** และ **race condition** ได้

### เปรียบเหมือน

เหมือนมีผู้ช่วยที่นั่งคอยดู whiteboard ตลอดเวลา พอเห็นว่ามีการเปลี่ยนแปลง ก็ลบแล้วเขียนใหม่ (setState) — แทนที่จะคำนวณผลลัพธ์ที่ถูกต้องตั้งแต่แรกเลย

`useMemo` เหมือนมีผู้ช่วยที่ฉลาดกว่า — คำนวณผลทันทีตอนที่ข้อมูล input เปลี่ยน ไม่ต้องรอรอบพิเศษ

### แก้ยังไง

เปลี่ยนจาก `useState + useEffect` เป็น `useMemo` ตามที่อธิบายไว้ใน Bug 3

### เรียนรู้อะไร

> **กฎ:** ถ้า ESLint บอกว่าผิด ให้เชื่อก่อนเสมอ — อย่า comment disable  
> ESLint rules ส่วนใหญ่มาจากบทเรียนเจ็บปวดของคนอื่น  
> `react-hooks/set-state-in-effect` มีอยู่เพราะ pattern นี้ทำ bug ใน production มาแล้วจริงๆ

---

## Design Gap ที่แก้ใน Review Pass

ส่วนนี้ไม่ใช่ bug ที่ทำให้โค้ดผิด แต่เป็นสิ่งที่ทำให้ UI ดูไม่ intentional — แก้ใน fix pass หลัง code review

| รหัส | ปัญหา | แก้ด้วยอะไร | เรียนรู้อะไร |
|------|--------|-------------|--------------|
| FD-1 | PreviewBox มีพื้นหลังเดียวกับ page (`bg-zinc-50`) ดูกลืนกัน | เปลี่ยนเป็น `bg-white border-t border-zinc-200` | ทุก section ที่แตกต่างกัน ต้องมี visual boundary ชัดเจน |
| FD-2 | ผลลัพธ์หลัง RUN โผล่ขึ้นมาทันที ไม่มี transition | เพิ่ม `animate-in fade-in duration-200` | การแสดงข้อมูลใหม่ควรมี entrance ให้ตา follow ได้ |
| FD-3 | SaveIndicator เปลี่ยนสีกระชาก | เพิ่ม `transition-colors duration-150` | แม้แค่ status text เล็กๆ ก็ควร smooth |
| FD-4 | ✓/✗ เป็น Unicode ตัวอักษรธรรมดา | ใช้ `CheckCircle2`/`XCircle` จาก lucide-react | ใช้ icon library ที่มีในโปรเจกต์อยู่แล้ว ไม่เขียน emoji ดิบ |
| FD-5 | Empty states เป็นแค่ข้อความลอยๆ ดูเหมือน placeholder | เพิ่ม `border border-dashed border-zinc-200 rounded px-3 py-2` | Empty state = ส่วนหนึ่งของ UI ที่ต้องออกแบบ ไม่ใช่แค่ข้อความ fallback |

---

## ตารางสรุป Bug ทั้งหมด

| Bug | ไฟล์ | ประเภท | Root Cause สั้นๆ | วิธีป้องกันในอนาคต |
|-----|------|--------|-----------------|-------------------|
| WR-01 | `formula-engine.ts` | Logic | Missing `default: never` ใน switch | ทุก switch บน union type ต้องมี exhaustive guard |
| WR-02 | `condition-evaluator.ts` | Logic | `Number()` silent NaN | ใช้ `toNumber` helper ที่ throw แทน |
| WR-03 | `BuilderShell.tsx` | React Pattern | `useEffect + setState` แทน `useMemo` | derived state → `useMemo` เสมอ |
| WR-04 | `formula.ts` | Naming / Scope | ชื่อฟังก์ชันกว้างเกิน + เรียกผิดที่ | ชื่อ guard function ต้องบอกว่าเช็คอะไร |
| M-1 | `BuilderShell.tsx` | ESLint | `setState` ใน `useEffect` body | อ่าน ESLint rules และเชื่อมัน |

---

## บทเรียนรวมของ Phase 8

### 1. TypeScript exhaustiveness เป็น safety net ที่ฟรี — ใช้มันเสมอ
ใส่ `default: { const x: never = discriminant }` ทุกครั้งที่ switch บน discriminated union

### 2. Helper ที่ throw ดีกว่า built-in ที่เงียบ
`Number("abc")` = `NaN` เงียบๆ  
`toNumber("abc", "hint")` = throw + message ชัด  
ถ้ามี helper ในโปรเจกต์แล้ว ให้ใช้ — อย่าเขียน `Number()` ตรงๆ

### 3. Derived state = `useMemo`, ไม่ใช่ `useEffect + setState`
ถ้าเห็น pattern นี้ให้ refactor ทันที:
```typescript
// ❌ สัญญาณอันตราย
useEffect(() => { setState(compute(otherState)) }, [otherState])

// ✅ แบบที่ถูก
const value = useMemo(() => compute(otherState), [otherState])
```

### 4. ชื่อฟังก์ชัน guard ต้องบอกว่ากำลัง guard อะไร
`requireValid` → ❌ กว้างเกิน  
`enforceFormulaDepthLimit` → ✅ รู้เลยว่าทำอะไร

### 5. Empty states และ Visual Boundary คือส่วนหนึ่งของ feature ไม่ใช่ afterthought
ทุก section ของ UI ต้องมี:
- **Loaded state** — แสดงข้อมูล
- **Empty state** — บอกผู้ใช้ว่าทำอะไรต่อ
- **Error state** — บอกว่าผิดพลาดอะไร

---

*Post-mortem เขียนโดย Claude (gsd-code-reviewer) | Phase 8 | 2026-05-21*  
*แก้ไขครบทุก finding | TypeScript: 0 errors | ESLint: 0 errors*
