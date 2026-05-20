# Onboarding Guide — Phase 2: tRPC Routers

> สำหรับ Developer มือใหม่ที่เพิ่งเข้ามาในโปรเจกต์
> อ่านไฟล์นี้ก่อนเปิด code ดีกว่า — ใช้เวลาประมาณ 5-10 นาที

---

## Phase 2 นี้ทำอะไร?

ลองนึกภาพว่าแอปเราเหมือนร้านอาหาร

- **Phase 1** คือการตั้งคลังวัตถุดิบ (ฐานข้อมูล) และ QC (Zod) เสร็จแล้ว
- **Phase 2** คือการสร้าง "เมนูอาหาร + พนักงานเสิร์ฟ" — browser เรียก endpoint อะไรได้บ้าง และใครไปหยิบจาก DB มาให้

ชั้นนี้เรียกว่า **API Layer** และเราใช้ **tRPC** แทน REST API ธรรมดา

---

## tRPC คืออะไร พูดแบบชาวบ้าน

REST API ธรรมดา:
```
Browser: "ขอ GET /api/formula/abc" (แค่ URL และ method)
Server: ส่ง JSON กลับมา
Browser: "ไม่รู้เลยว่าจะได้อะไร ต้องเขียน type เอง"
```

tRPC:
```
Browser: "เรียก trpc.formula.get({ id: 'abc' })"
TypeScript: "ผลลัพธ์ต้องเป็น { id, name, state, updatedAt } | null"
Browser: "รู้เลย! ไม่ต้องเดา"
```

**สรุป:** tRPC ทำให้ TypeScript รู้ว่า API รับอะไรและคืนอะไร — โดยอ่านจาก server code โดยตรง ไม่ต้องเขียน type ซ้ำสองฝั่ง

---

## โครงสร้างไฟล์ Phase 2

```
condition-builder/
├── src/
│   ├── server/
│   │   ├── trpc.ts              ★ ตั้งค่า tRPC ครั้งเดียว
│   │   ├── root.ts              ★ รวม routers ทั้งหมด
│   │   └── routers/
│   │       └── formula.ts       ★ endpoint จริงๆ ของ Formula
│   ├── app/
│   │   └── api/trpc/[trpc]/
│   │       └── route.ts         ★ ประตู HTTP ที่ browser เรียก
│   └── lib/
│       ├── schema.ts            ★ (อัปเดตจาก Phase 1) เพิ่ม BUILDER_LIMITS
│       └── trpc/
│           ├── client.ts        ★ สร้าง React hooks
│           └── provider.tsx     ★ ครอบ App ด้วย context
```

---

## วิธีที่ request ไหลผ่านระบบ

```
Browser
  → เรียก trpc.formula.get({ id })
  → HTTP GET /api/trpc/formula.get?...
  → route.ts (รับ request)
  → appRouter (root.ts) → formulaRouter (formula.ts)
  → db.formula.findUnique (Phase 1: db.ts)
  → Neon PostgreSQL
  → ส่ง JSON กลับผ่าน superjson
  → Browser ได้ { id, name, state: BuilderState, updatedAt }
```

---

## ไฟล์ทีละไฟล์ — อธิบายแบบชาวบ้าน

### 1. `src/server/trpc.ts` — เปิดสวิตช์ tRPC

```typescript
const t = initTRPC.create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
```

สร้างแค่ครั้งเดียว แล้ว export สองชิ้นที่ทุกไฟล์ import ไปใช้:

- **`router`** — กล่องรวม endpoints
- **`publicProcedure`** — แม่พิมพ์สร้าง endpoint ตัวเดียว

`superjson` คือ serializer พิเศษ — JSON ธรรมดาไม่รู้จัก `Date`, `Map`, `BigInt` แต่ superjson รู้จัก เวลาส่งข้อมูลระหว่าง server↔client จะแปลงได้ถูกต้อง

---

### 2. `src/server/root.ts` — สมุดโทรศัพท์ API

```typescript
export const appRouter = router({
  formula: formulaRouter,
})

export type AppRouter = typeof appRouter
```

ไฟล์สั้น แต่สำคัญมาก:

- `formula: formulaRouter` — ทุก endpoint ใน formulaRouter จะมีชื่อขึ้นต้นด้วย `formula.` เช่น `formula.get`, `formula.upsert`
- `AppRouter` type — ส่งไปให้ client รู้ว่า API มีอะไรบ้าง ถ้าเรียก endpoint ที่ไม่มี TypeScript จะ error ทันที

---

### 3. `src/lib/schema.ts` — อัปเดตจาก Phase 1

Phase 2 เพิ่มสิ่งใหม่สองอย่าง:

**BUILDER_LIMITS — ค่า limit ทั้งหมดอยู่ที่เดียว:**
```typescript
export const BUILDER_LIMITS = {
  TABLES: 50,       // มีตารางได้มากสุด 50 ตาราง
  CONDITIONS: 200,  // มีเงื่อนไขได้มากสุด 200 ข้อ
  RESULTS: 50,      // มีสูตรผลลัพธ์ได้มากสุด 50 ตัว
  FORMULA_DEPTH: 20, // สูตรซ้อนได้ลึกสุด 20 ชั้น
  STR_NAME: 200,    // ชื่อยาวได้มากสุด 200 ตัวอักษร
  // ...
} as const
```

**isFormulaDepthOk — ป้องกัน formula ลึกเกิน:**
```typescript
function isFormulaDepthOk(node: FormulaNode, depth: number): boolean {
  if (depth > BUILDER_LIMITS.FORMULA_DEPTH) return false
  // ... check ลูกซ้าย ลูกขวา ซ้ำๆ
}
```

`ResultFormulaSchema` ใช้ `.superRefine()` เรียกฟังก์ชันนี้ — ถ้า formula ลึกเกิน 20 ชั้น Zod จะ reject ก่อนที่ data จะไปถึง DB เลย

---

### 4. `src/server/routers/formula.ts` — หัวใจของ Phase 2

ไฟล์นี้มี 8 endpoints และ 2 helper functions:

#### Helper: requireState

```typescript
function requireState(raw: unknown) {
  const state = safeParseBuilderState(raw)
  if (!state) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', ... })
  return state
}
```

ใช้ทุกครั้งที่ดึงข้อมูลจาก DB — ป้องกัน corrupt data ออกมาถึง client

#### Helper: requireValidState

```typescript
function requireValidState(updated: BuilderState) {
  const result = safeParseBuilderState(updated)
  if (!result) throw new TRPCError({ code: 'BAD_REQUEST', ... })
  return result
}
```

ใช้ก่อน write กลับ DB — ตรวจว่า state ใหม่ยังอยู่ในขอบเขต `.max()` ที่กำหนด

#### Endpoints ทั้ง 8 ตัว

| Endpoint | ประเภท | ทำอะไร |
|----------|--------|--------|
| `formula.get` | query | ดึง Formula โดย id |
| `formula.upsert` | mutation | สร้างใหม่หรืออัปเดต Formula ทั้งก้อน |
| `formula.addTable` | mutation | เพิ่ม table ใหม่ใน Formula |
| `formula.removeTable` | mutation | ลบ table ออกจาก Formula |
| `formula.addCondition` | mutation | เพิ่ม condition ใหม่ |
| `formula.removeCondition` | mutation | ลบ condition |
| `formula.addResult` | mutation | เพิ่ม result formula ใหม่ |
| `formula.removeResult` | mutation | ลบ result formula |

#### Pattern ที่ใช้ซ้ำทุก mutation: Read-Modify-Write

```typescript
db.$transaction(async (tx) => {
  // 1. อ่าน (ภายใน transaction)
  const formula = await tx.formula.findUnique({ where: { id } })
  if (!formula) throw new TRPCError({ code: 'NOT_FOUND', ... })

  // 2. แก้ (immutable — สร้าง object ใหม่)
  const state = requireState(formula.state)
  const updated = requireValidState({ ...state, tables: [...state.tables, newTable] })

  // 3. เขียน (ยังอยู่ใน transaction เดียวกัน)
  return tx.formula.update({ where: { id }, data: { state: updated } })
})
```

**ทำไมต้องใช้ transaction?** ป้องกัน race condition — ถ้า browser tab 2 อันส่ง request พร้อมกัน โดยไม่มี transaction อาจเกิด:
- Tab A: อ่าน state → มี 3 tables
- Tab B: ลบ table ที่ 3 ออก
- Tab A: เพิ่ม table ใหม่บน state เก่าที่มี 3 tables → table ที่ B ลบไปกลับมาอีก!

Transaction ป้องกันสิ่งนี้โดย lock record ระหว่างที่ทำงาน

---

### 5. `src/app/api/trpc/[trpc]/route.ts` — ประตู HTTP

```typescript
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error, path }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`tRPC error on [${path}]:`, error)
      }
    },
  })

export { handler as GET, handler as POST }
```

Next.js App Router ส่ง request ทุกอันที่มา URL `/api/trpc/*` มาที่ไฟล์นี้ ชื่อโฟลเดอร์ `[trpc]` คือ wildcard — จับ `/api/trpc/formula.get`, `/api/trpc/formula.upsert` ฯลฯ แล้ว tRPC แยกเองว่าจะเรียก endpoint ไหน

`onError` log เฉพาะ error ที่ไม่คาดคิด (INTERNAL_SERVER_ERROR) — error ที่ client ส่งผิด (NOT_FOUND, BAD_REQUEST) ไม่ต้อง log เพราะเป็นพฤติกรรมปกติ

---

### 6. `src/lib/trpc/client.ts` — เปิดประตูให้ React

```typescript
export const trpc = createTRPCReact<AppRouter>()
```

บรรทัดเดียวนี้สร้าง React hooks ทั้งหมดที่ต้องการ ส่ง `AppRouter` type เข้าไปเพื่อให้ TypeScript รู้รูปร่าง API

ตัวอย่างการใช้งาน (Phase 3+):
```typescript
// ใน React component
const { data, isLoading } = trpc.formula.get.useQuery({ id: formulaId })
const upsert = trpc.formula.upsert.useMutation()

// เรียก mutation
await upsert.mutateAsync({ id: formulaId, state: newState })
```

---

### 7. `src/lib/trpc/provider.tsx` — ห่อ App ด้วย context

```typescript
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

**Phase 3** จะครอบ `layout.tsx` ด้วย `<TRPCProvider>` — หลังจากนั้น component ทุกตัวในแอปจะใช้ `trpc.*` hooks ได้เลย

`httpBatchLink` รวม request หลายๆ ตัวที่ยิงพร้อมกันไปใน HTTP call เดียว — เช่น ถ้า component 3 ตัว query พร้อมกันตอน load หน้า จะส่ง request เดียวไม่ใช่ 3 ครั้ง

`getBaseUrl()`:
- ถ้า browser เรียก → ใช้ `''` (relative URL ตัวเอง)
- ถ้า server render → ใช้ `VERCEL_URL` หรือ `localhost:3000`

---

## Data Flow ตั้งแต่ UI จนถึง DB

```
React Component (Phase 3+)
    ↓ trpc.formula.get.useQuery({ id })
TRPCProvider (provider.tsx)
    ↓ HTTP GET /api/trpc/formula.get
route.ts (HTTP handler)
    ↓ appRouter → formulaRouter.get
formula.ts (get procedure)
    ↓ db.formula.findUnique (db.ts จาก Phase 1)
Neon PostgreSQL
    ↑ { id, name, state: Json, updatedAt }
requireState() → safeParseBuilderState → BuilderState
    ↑ ส่ง { id, name, state: BuilderState, updatedAt }
React Component ได้ข้อมูล type-safe
```

---

## ความปลอดภัยที่ใส่ไว้ใน Phase 2

| ปัญหา | วิธีแก้ | ไฟล์ |
|-------|--------|------|
| Race condition (2 browser tabs แก้พร้อมกัน) | `db.$transaction` ทุก mutation | `formula.ts` |
| Corrupt data จาก DB | `requireState` + `safeParseBuilderState` | `formula.ts`, `schema.ts` |
| สูตรลึกเกิน (stack overflow) | `isFormulaDepthOk` + `superRefine` | `schema.ts` |
| เพิ่ม item เกิน limit | `requireValidState` re-validate ก่อน write | `formula.ts` |
| Error leak โครงสร้างภายใน | `TRPCError` แทน raw `ZodError` | `formula.ts` |
| Formula ไม่เจอ | `TRPCError { code: 'NOT_FOUND' }` | `formula.ts` |

---

## คำสั่งที่ใช้บ่อย

| ต้องการทำ | คำสั่ง |
|-----------|--------|
| รัน Dev server | `npm run dev` |
| ตรวจ TypeScript | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| ดู DB | `npx prisma studio` |

---

## ข้อผิดพลาดที่มักเจอ

| Error | สาเหตุ | แก้ยังไง |
|-------|--------|----------|
| `TRPCClientError: Formula not found` | ส่ง id ที่ไม่มีใน DB | ตรวจ id ที่ส่งไป |
| `TRPCClientError: Formula state is corrupt` | data ใน DB ผิดรูปแบบ | ดู DB ด้วย `prisma studio` |
| `TRPCClientError: Operation would exceed builder limits` | เพิ่ม item เกิน limit | ลบ item บางตัวก่อน |
| TypeScript error: `Property 'xxx' does not exist on type AppRouter` | เรียก endpoint ที่ไม่มี | ตรวจชื่อ endpoint ใน `formula.ts` |

---

## Cheat Sheet — ลำดับ dependency

```
src/lib/schema.ts (Zod schemas + BUILDER_LIMITS)
    ↓
src/server/trpc.ts (tRPC init)
    ↓
src/server/routers/formula.ts (endpoints)
    ↓
src/server/root.ts (AppRouter type)
    ↓
src/app/api/trpc/[trpc]/route.ts (HTTP handler)

-------- client side --------

src/server/root.ts (AppRouter type export)
    ↓
src/lib/trpc/client.ts (createTRPCReact<AppRouter>)
    ↓
src/lib/trpc/provider.tsx (TRPCProvider)
    ↓
src/app/layout.tsx (Phase 3: ครอบด้วย TRPCProvider)
    ↓
React components ใช้ trpc.formula.*.useQuery/useMutation ได้
```

---

## สิ่งที่ Phase 3 จะสร้างต่อจากนี้

Phase 2 วางชั้น API เรียบร้อยแล้ว Phase 3 จะเชื่อม UI เข้ากับ API:

```
UI (Phase 3+) → tRPC (Phase 2) → db.ts (Phase 1) → Neon DB
```

ไฟล์ที่ Phase 3 จะสร้าง/แก้:
- `src/app/layout.tsx` — ครอบด้วย `<TRPCProvider>`
- `src/app/(builder)/page.tsx` — หน้า Builder หลัก
- `src/store/builder-store.ts` — Zustand store เก็บ BuilderState
- Hook auto-save — debounce 500ms → `trpc.formula.upsert.mutate()`
- Layout shell: header + 4 panels (Field, Condition, Actions, Result)
