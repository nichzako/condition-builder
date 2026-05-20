# Onboarding Guide — Phase 3: Frontend Foundation

> สำหรับ Developer มือใหม่ที่เพิ่งเข้าโปรเจกต์ Phase 3 นี้วาง "รากฐาน" ของ UI ทั้งหมด  
> อ่านไฟล์นี้ก่อนดู code จะทำให้เข้าใจภาพรวมได้เร็วขึ้นมาก

---

## Phase 3 ทำอะไร (สั้นๆ)

ก่อน Phase 3 มีแค่ API (tRPC) กับ Database (Prisma) แต่ยังไม่มีหน้าจอให้ user ใช้งาน

Phase 3 เพิ่ม:
1. **เชื่อม React กับ tRPC** ผ่าน TRPCProvider
2. **ความจำของแอป** ผ่าน Zustand Store
3. **Auto-save** — บันทึกอัตโนมัติเมื่อ state เปลี่ยน
4. **โครง UI** — header + 5 panel sections (เปล่าๆ รอ Phase 4-8 เติม)
5. **Error protection** — ถ้า component พัง แอปไม่ crash ทั้งหน้า

---

## ไฟล์สำคัญที่ต้องรู้จัก

```
src/
├── app/
│   ├── layout.tsx                      ← ① ครอบทุกหน้าด้วย TRPCProvider
│   ├── page.tsx                        ← redirect ไป /builder
│   └── builder/
│       └── page.tsx                    ← ② entry point ของ builder UI
├── lib/
│   └── trpc/
│       ├── client.ts                   ← สร้าง tRPC client
│       └── provider.tsx                ← ③ TRPCProvider (QueryClient + trpcClient)
├── store/
│   └── builder-store.ts                ← ④ Zustand store (ความจำของแอป)
├── hooks/
│   └── use-auto-save.ts                ← ⑤ บันทึกอัตโนมัติ debounce 500ms
└── components/
    ├── ui/
    │   └── error-boundary.tsx          ← ⑥ กัน app crash เมื่อ component พัง
    └── builder/
        ├── BuilderClient.tsx           ← ⑦ โหลดข้อมูลจาก DB + เริ่ม auto-save
        ├── BuilderShell.tsx            ← ⑧ โครงหน้าจอ (header + panels)
        ├── FieldPanel.tsx              ← stub — เติมใน Phase 4
        ├── ConditionPanel.tsx          ← stub — เติมใน Phase 6
        ├── ActionPanel.tsx             ← stub — เติมใน Phase 4
        ├── ResultPanel.tsx             ← stub — เติมใน Phase 7
        └── PreviewBox.tsx              ← stub — เติมใน Phase 8
```

---

## อธิบายทีละชิ้น (ภาษาชาวบ้าน)

### ① layout.tsx — ประตูหลักของแอป

```tsx
<body>
  <TRPCProvider>{children}</TRPCProvider>
</body>
```

**เปรียบได้กับ:** เปิด WiFi ไว้ที่บ้านทั้งหลัง ทุกห้อง (ทุกหน้า) ใช้ internet ได้โดยไม่ต้องเปิดเอง

ถ้าไม่มี TRPCProvider — ทุก component ที่ใช้ `trpc.xxx.useQuery()` จะ error

---

### ② builder/page.tsx — หน้าแรกที่ user เห็น

```tsx
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <BuilderClient />
  </Suspense>
</ErrorBoundary>
```

**สองชั้นป้องกัน:**
- `Suspense` — แสดง "Loading..." ขณะรอ component โหลด (Next.js บังคับใช้เมื่อใช้ `useSearchParams`)
- `ErrorBoundary` — ถ้า component ลูกโยน error จะแสดง fallback UI แทน crash

---

### ③ TRPCProvider — ตัวกลางระหว่าง React กับ API

ไฟล์: `src/lib/trpc/provider.tsx`

สร้างของ 2 ชิ้น:
| ชิ้น | หน้าที่ |
|---|---|
| `QueryClient` | Cache ข้อมูลจาก server ไว้ให้ไม่ต้อง fetch ซ้ำ |
| `trpcClient` | ส่ง HTTP request ไป `/api/trpc` |

**เหตุผลที่ใช้ `useState(() => new QueryClient())`** — ถ้าเขียน `new QueryClient()` ตรงๆ จะสร้างใหม่ทุก re-render ซึ่งจะล้าง cache ทิ้งหมด

---

### ④ builder-store.ts — ความจำของแอป (Zustand)

ไฟล์: `src/store/builder-store.ts`

เก็บ state ทั้งหมดที่แอปต้องการ:

```
formulaId    — ID ของ formula ที่กำลังเปิดอยู่
name         — ชื่อ formula
state        — BuilderState ทั้งหมด (tables, conditions, results)
saveStatus   — 'idle' | 'saving' | 'saved' | 'error'
isDirty      — มีอะไรรอ save หรือเปล่า
```

**กฎสำคัญ:** `isDirty` มี 2 โหมด
- `setState(data)` จาก DB → `isDirty = false` (ไม่มีของใหม่ต้อง save)
- `addTable()`, `setName()`, ฯลฯ จาก user → `isDirty = true` (มีของรอ save)

ถ้าไม่มีกฎนี้ แอปจะ save state เปล่าๆ กลับไป DB ตอนโหลดหน้า

---

### ⑤ use-auto-save.ts — บันทึกอัตโนมัติ

ไฟล์: `src/hooks/use-auto-save.ts`

**ทำงาน 3 ขั้นตอน:**

```
user ทำอะไรบางอย่าง
      ↓
isDirty = true + state เปลี่ยน
      ↓
รอ 500ms (ถ้า user ยังไม่หยุด ก็รีเซ็ตนับใหม่)
      ↓
ส่ง mutation ไป server (trpc.formula.upsert)
      ↓
ได้ formulaId กลับมา → อัปเดต store + URL
```

**parameter `enabled`** — ส่ง `false` ตอนกำลังโหลดข้อมูลจาก DB เพื่อไม่ให้ save state เปล่าก่อนข้อมูลมาถึง

**race condition fix:** ใส่ `upsert.isPending` ใน deps ของ useEffect ทำให้เมื่อ mutation เสร็จ effect re-run อัตโนมัติและจับ dirty state ที่สะสมระหว่างรอได้

---

### ⑥ error-boundary.tsx — ตาข่ายรับนักกายกรรม

ไฟล์: `src/components/ui/error-boundary.tsx`

```
component ลูก โยน Error
         ↓
React เรียก getDerivedStateFromError()
         ↓
hasError = true → render fallback แทน
         ↓
user กด "Retry" → reset hasError = false → render ใหม่
```

**ทำไมต้องเป็น class component?** — React ยังไม่มี error boundary แบบ hook ต้องใช้ class เท่านั้น

---

### ⑦ BuilderClient.tsx — orchestrator

ไฟล์: `src/components/builder/BuilderClient.tsx`

หน้าที่หลัก 3 อย่าง:

**1. อ่าน URL และโหลด formula**
```
URL มี ?id=xxx → query DB → รอข้อมูล
URL ไม่มี id → เริ่มเปล่าๆ
```

**2. Hydrate store**
```
data กลับมา → setState(data) → isDirty ยังคง false
            → setAutoSaveEnabled(true) → auto-save เริ่มทำงาน
```

**3. อัปเดต URL เมื่อสร้าง formula ใหม่**
```
save ครั้งแรก → ได้ formulaId → push ?id=xxx ขึ้น URL
```

---

### ⑧ BuilderShell.tsx — โครงหน้าจอ

ไฟล์: `src/components/builder/BuilderShell.tsx`

```
┌─────────────────────────────────────┐
│ [ชื่อ formula]  [Saving...]    [RUN]│  ← Header (sticky)
├─────────────────────────────────────┤
│ Fields (stub → Phase 4)             │
├─────────────────────────────────────┤
│ Condition (stub → Phase 6)          │
├─────────────────────────────────────┤
│ Actions (stub → Phase 4)            │
├─────────────────────────────────────┤
│ Result (stub → Phase 7)             │
├─────────────────────────────────────┤
│ Preview (stub → Phase 8)            │
└─────────────────────────────────────┘
```

**SaveIndicator** — แสดง 4 state และ auto-dismiss "Saved" ใน 2 วินาที

---

## Data Flow ทั้งระบบ (Phase 3)

```
เปิด /builder?id=xxx
         ↓
BuilderClient อ่าน id จาก URL
         ↓
trpc.formula.get.useQuery({id})  ←→  Prisma DB
         ↓
data กลับมา → useBuilderStore.setState() [isDirty=false]
         ↓
setAutoSaveEnabled(true)
         ↓
         ↓ ← user แก้ไข (addTable, setName ฯลฯ)
         ↓
isDirty=true + state เปลี่ยน
         ↓
useAutoSave รอ 500ms
         ↓
trpc.formula.upsert.mutate()  →→→  Prisma DB
         ↓
saveStatus='saved' → 2 วิ → 'idle'
```

---

## คำถามที่มักสงสัย

**Q: ทำไมต้องมี isDirty? ทำไมไม่ save ทุกครั้งที่ state เปลี่ยน?**
A: `setState()` (โหลดจาก DB) ก็ทำให้ state เปลี่ยน ถ้าไม่มี isDirty จะ save state เปล่าๆ กลับไปทันที ทับ data จริงที่เพิ่ง load มา

**Q: ทำไม BuilderClient แยกออกจาก builder/page.tsx?**
A: `useSearchParams()` ต้องอยู่ใน client component ที่ครอบด้วย Suspense — ถ้าเขียนใน Server Component จะ error ตอน build

**Q: ErrorBoundary ต้องใช้ class component ตลอดไปไหม?**
A: ใน React ปัจจุบัน ใช่ แต่ library อย่าง `react-error-boundary` ช่วย wrap ให้ hook-friendly ได้

**Q: Panel stubs มีแค่ข้อความเปล่าๆ มันถูกต้องไหม?**
A: ถูกต้องสำหรับ Phase 3 — Phase นี้เน้นวาง infrastructure (Provider, Store, Auto-save) ให้พร้อม แล้วค่อยเติม UI จริงใน Phase ถัดไป

---

## สิ่งที่ Phase 4 จะเพิ่ม

Phase 4 จะแทนที่ `FieldPanel.tsx` stub ด้วยของจริง:
- Table cards — สร้าง/ลบ table
- Field list — add/remove fields ในแต่ละ table
- Field chip component — พร้อมรองรับ drag & drop ใน Phase 5

ทุก action ใน Phase 4 จะ flow ผ่าน store (`addTable`, `removeTable`, ฯลฯ) → auto-save → DB โดยอัตโนมัติ ไม่ต้องเขียน save logic เพิ่ม

---

## Code Tour

ดู `.tours/new-joiner-phase3-frontend-foundation.tour` สำหรับ guided walkthrough แบบ step-by-step ในแต่ละไฟล์  
ติดตั้ง [CodeTour extension](https://marketplace.visualstudio.com/items?itemName=vsls-contrib.codetour) บน VS Code แล้วเปิดจาก Explorer panel
