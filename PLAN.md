# Condition Builder — Phase Plan

> ทำทีละ Phase แล้วหยุดให้ตรวจก่อนเสมอ ห้ามข้าม Phase โดยไม่ได้รับอนุมัติ

---

## สถานะปัจจุบัน

| Phase | ชื่อ | สถานะ |
|-------|------|--------|
| 0 | Project Scaffold | ✅ Done |
| 1 | Data Layer | ✅ Done |
| 2 | tRPC Routers | ✅ Done |
| 3 | Frontend Foundation | ✅ Done |
| 4 | Field Panel + Auto-save | ⏳ ถัดไป |
| 5 | Drag & Drop Foundation | — |
| 6 | Condition Panel | — |
| 7 | Result / Formula Panel | — |
| 8 | Formula Engine + RUN | — |
| 9 | Polish + Testing | — |

---

## Phase 0 — Project Scaffold ✅

**เป้าหมาย:** ได้ Next.js 16 app ที่ build ผ่าน พร้อม dependencies ครบ

งานที่ทำ:
- Scaffold Next.js 16 + TypeScript + Tailwind CSS v4
- Install shadcn/ui + base components
- Install core deps: zustand, zod, @dnd-kit, @trpc/server, @tanstack/react-query, prisma, superjson
- สร้าง folder structure + landing page (`src/app/page.tsx`)
- เพิ่ม `.env.example` + อัปเดต CLAUDE.md
- Fix Turbopack issue (Node 24 + Windows) → ใช้ `--webpack` flag

---

## Phase 1 — Data Layer ⏳

**เป้าหมาย:** Prisma schema พร้อม migrate + Zod shared schemas + seed data

งานหลัก:
1. **Prisma Schema** (`prisma/schema.prisma`) — models:
   - `Formula` — container สำหรับ BuilderState ทั้งหมด (tables, conditions, results เก็บเป็น JSONB)
   - `TableSource` — หรืออาจ embed ใน Formula JSONB ตาม design decision
2. **Zod Schemas** (`src/lib/schema.ts`) — shared client/server:
   - `TableSourceSchema`, `FieldDefSchema`, `FieldRefSchema`
   - `ConditionSchema`, `FormulaNodeSchema` (recursive), `ResultFormulaSchema`
   - `BuilderStateSchema`
3. **Prisma Client singleton** (`src/server/db.ts`)
4. **TypeScript types** (`src/types/index.ts`) — infer จาก Zod schemas
5. **Seed script** (`prisma/seed.ts`) — mock data: Table1 (3 fields), Table2 (3 fields)
6. **Migration** — `npx prisma migrate dev`

ข้อกำหนดก่อนเริ่ม:
- ต้องการ `DATABASE_URL` + `DIRECT_URL` จาก Vercel Postgres
- รัน `vercel env pull .env.local` เพื่อดึง credentials

---

## Phase 2 — tRPC Routers

**เป้าหมาย:** CRUD endpoints สำหรับ Formula/BuilderState ผ่าน tRPC

งานหลัก:
1. **tRPC init** (`src/server/trpc.ts`) — base router + procedure
2. **Formula router** (`src/server/routers/formula.ts`):
   - `formula.get` — load BuilderState by id
   - `formula.upsert` — save ทั้ง BuilderState
   - `formula.addTable`, `formula.removeTable`
   - `formula.addCondition`, `formula.removeCondition`
   - `formula.addResult`, `formula.removeResult`
3. **Root router** (`src/server/root.ts`) — merge routers
4. **HTTP handler** (`src/app/api/trpc/[trpc]/route.ts`)
5. **tRPC client** (`src/lib/trpc/`) — client + provider setup

---

## Phase 3 — Frontend Foundation

**เป้าหมาย:** App shell + tRPC Provider + Builder route ที่ load/save state ได้

งานหลัก:
1. **tRPC Provider** ใน `src/app/layout.tsx` (TanStack Query + tRPC)
2. **Builder route** `src/app/(builder)/page.tsx`
3. **Zustand store** (`src/store/builder-store.ts`) — BuilderState + actions
4. **Auto-save hook** — debounce 500ms → tRPC mutation
5. Layout shell: header bar (title + RUN button), 4 panels (Field, Condition, Actions, Result)

---

## Phase 4 — Field Panel + Auto-save

**เป้าหมาย:** สร้าง/ลบ Table cards + add/remove fields + persist ผ่าน tRPC

งานหลัก:
1. **FieldPanel component** (`src/components/builder/FieldPanel.tsx`)
2. Table card UI: ชื่อ table, list fields, [+] add field, [x] remove table
3. [Add Field +] button → เพิ่ม table ใหม่
4. Field chip component (พร้อมรองรับ drag ใน Phase 5)
5. Auto-save เมื่อ state เปลี่ยน

---

## Phase 5 — Drag & Drop Foundation

**เป้าหมาย:** @dnd-kit setup + draggable field chips + droppable slots

งานหลัก:
1. **DndContext** ครอบ layout ทั้งหมด
2. **DraggableField** (`src/components/dnd/DraggableField.tsx`) — FieldRef payload
3. **DropZone** (`src/components/dnd/DropZone.tsx`) — รับ FieldRef drop
4. Collision detection strategy
5. Visual feedback ขณะ drag (ghost, highlight drop zone)

---

## Phase 6 — Condition Panel

**เป้าหมาย:** Condition rows ที่ drop field ได้ + เลือก operator

งานหลัก:
1. **ConditionPanel** (`src/components/builder/ConditionPanel.tsx`)
2. Condition row: [LeftField] — (operator dropdown) — [RightField] — [x]
3. Operator dropdown: equal, greater_than, less_than, not_equal, contains
4. Left/Right slot รับ FieldRef จาก drag หรือ literal value
5. [+] เพิ่ม condition ใหม่
6. Auto-save

---

## Phase 7 — Result / Formula Panel

**เป้าหมาย:** Recursive formula tree UI ที่สร้าง FormulaNode ได้

งานหลัก:
1. **ResultPanel** (`src/components/builder/ResultPanel.tsx`)
2. Formula row: [ResultName] — [FormulaNode visual]
3. FormulaNode visual: แสดง tree แบบ inline — `[A] (+) [B]` หรือ `[A] (%) [B]`
4. Drop field เข้า node slot
5. เพิ่ม operation node (+, -, *, /, %)
6. [+] เพิ่ม result ใหม่

---

## Phase 8 — Formula Engine + RUN

**เป้าหมาย:** กด RUN แล้วได้ผลลัพธ์จริงจาก data context

งานหลัก:
1. **Formula Engine** (`src/lib/formula-engine.ts`) — evaluate `FormulaNode` → result
2. **Condition Evaluator** (`src/lib/condition-evaluator.ts`)
3. tRPC endpoint: `formula.evaluate` — รับ BuilderState + data context → return results
4. **PreviewBox** (`src/components/builder/PreviewBox.tsx`) — แสดง output
5. Mock data context สำหรับ demo/test

---

## Phase 9 — Polish + Testing

**เป้าหมาย:** UX ดี + test coverage ≥ 80% + production-ready

งานหลัก:
1. Validation UX — error states, empty states, loading states
2. Undo/redo (Zustand middleware หรือ history stack)
3. **Vitest unit tests** — formula-engine, condition-evaluator, Zod schemas
4. **Playwright E2E** — add table → add condition → set formula → RUN → verify output
5. Responsive layout (tablet minimum)
6. Performance check (bundle size, LCP)
7. Production build + Vercel deploy verify

---

## Design Decisions บันทึกไว้

| Decision | ทางเลือก | เหตุผล |
|----------|----------|--------|
| Next.js แทน Vite+Fastify | 2 services | Single Vercel deploy, tRPC built-in |
| tRPC แทน REST | REST + OpenAPI | End-to-end type safety, Zod shared |
| Zustand แทน Redux | Redux Toolkit | Boilerplate น้อย, formula tree update บ่อย |
| Vercel Postgres (Neon) | Docker local | Connection pooling built-in, dev=prod DB |
| Formula as JSONB AST | Serialized string | Evaluate/render ได้โดยไม่ต้อง parse string |
| Formula Engine on server | Client-side eval | ใกล้ PG data, ง่ายต่อ audit/log |
| --webpack flag | Turbopack | Turbopack ไม่รองรับ Node 24 + Windows |
