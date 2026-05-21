# Onboarding Guide — Phase 1: Data Layer

> สำหรับ Developer มือใหม่ที่เพิ่งเข้ามาในโปรเจกต์
> อ่านไฟล์นี้ก่อนเปิด code ดีกว่า — ใช้เวลาประมาณ 5-10 นาที

---

## Phase 1 นี้ทำอะไร?

ลองนึกภาพว่าแอปเราเหมือนร้านอาหาร

- **ฐานข้อมูล (Database)** คือ "คลังเก็บวัตถุดิบ" อยู่ที่ Vercel Postgres บนคลาวด์
- **Prisma** คือ "พนักงานสต็อก" — คนกลางที่คุยกับคลังให้เรา ไม่ต้องพิมพ์ SQL เอง
- **Zod** คือ "QC ตรวจสอบวัตถุดิบ" — ก่อนข้อมูลจะเข้าหรือออกจากระบบ ต้องผ่าน Zod ก่อนเสมอ
- **TypeScript types** คือ "เมนูที่บอกว่าวัตถุดิบแต่ละชิ้นมีรูปร่างยังไง"

Phase 1 คือการวาง "ชั้นข้อมูล" ทั้งหมดนี้ให้พร้อมก่อน Phase ต่อไปจะเริ่ม build UI

---

## โครงสร้าง Data ของแอปนี้

แอป Condition Builder เก็บข้อมูลแค่ **1 ตารางในฐานข้อมูล** ชื่อ `Formula`

```
Formula
├── id        — รหัสเฉพาะ (cuid เช่น "clxyz123")
├── name      — ชื่อสูตร เช่น "Demo Formula"
├── state     — JSON ใหญ่ก้อนเดียว เก็บทุกอย่าง ↓
│              {
│                tables: [...]       ← Data Sources ทั้งหมด
│                conditions: [...]   ← เงื่อนไขที่ตั้งไว้
│                results: [...]      ← สูตรคำนวณผล
│              }
├── createdAt — วันที่สร้าง
└── updatedAt — วันที่แก้ล่าสุด
```

ทำไมเก็บแบบ JSON ก้อนเดียว? เพราะ state ทั้งหมดเปลี่ยนพร้อมกันทุกครั้งที่ user ลาก drop — ไม่ต้อง JOIN หลายตาราง ง่ายกว่ามาก

---

## ไฟล์ที่เกี่ยวข้องใน Phase 1

```
condition-builder/
├── prisma/
│   ├── schema.prisma        ★ พิมพ์แบบของตารางในฐานข้อมูล
│   ├── migrations/          ★ SQL ที่ Prisma สร้างให้อัตโนมัติ
│   ├── seed.ts              ★ ใส่ข้อมูลตัวอย่างลง DB
│   └── *.config.ts          ★ Config สำหรับ Prisma CLI (Prisma 7)
├── prisma.config.ts         ★ บอก Prisma ว่า DB อยู่ที่ไหน
└── src/
    ├── server/
    │   └── db.ts            ★ ประตูเข้า DB — ใช้ตัวนี้ตลอด
    ├── lib/
    │   └── schema.ts        ★ ตัวตรวจสอบ + นิยามรูปร่าง data
    └── types/
        └── index.ts         ★ Type ที่ใช้ทั่ว project
```

---

## ไฟล์ทีละไฟล์ — อธิบายแบบชาวบ้าน

### 1. `prisma/schema.prisma` — พิมพ์เขียวของ DB

```prisma
model Formula {
  id        String   @id @default(cuid())   // primary key
  name      String   @default("Untitled")
  state     Json                            // เก็บ BuilderState ทั้งก้อน
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([updatedAt])  // ค้นหาเร็วขึ้นเมื่อ sort ตาม updatedAt
  @@index([name])       // ค้นหาเร็วขึ้นเมื่อ filter ตามชื่อ
}
```

ทุกครั้งที่แก้ไฟล์นี้ ต้องรัน `npx prisma migrate dev` เพื่อส่งการเปลี่ยนแปลงไปที่ DB จริง

---

### 2. `prisma.config.ts` — บอก Prisma CLI ว่า DB อยู่ที่ไหน

**Prisma 7 (version ที่เราใช้) เปลี่ยน behavior สำคัญ:** URL ของ DB ไม่ได้เขียนใน `schema.prisma` แล้ว ต้องเขียนในไฟล์นี้แทน

```typescript
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: directUrl,  // DIRECT_URL จาก .env.local
  },
})
```

**ทำไมต้องใช้ `DIRECT_URL` ไม่ใช่ `DATABASE_URL`?**
- `DATABASE_URL` = เชื่อมต่อแบบ "รวมกลุ่ม" (connection pool) — เหมาะกับ API calls
- `DIRECT_URL` = เชื่อมต่อตรง — เหมาะกับ migration และ seed (ต้องการ connection ที่ไม่ถูก pool)

---

### 3. `src/server/db.ts` — ประตูเข้า DB สำหรับ Runtime

```typescript
export const db = globalForPrisma.prisma ?? createPrismaClient()
```

ไฟล์นี้สร้าง Prisma Client ครั้งเดียว แล้วนำกลับมาใช้ซ้ำตลอด (Singleton Pattern)

**ทำไม?** Next.js restart server บ่อยมากตอน development (Hot Reload) — ถ้าสร้าง Client ใหม่ทุกครั้ง จะ error เพราะ connection เต็ม

ใช้ไฟล์นี้ทุกครั้งที่อยากเข้า DB:
```typescript
import { db } from '@/server/db'

const formula = await db.formula.findUnique({ where: { id: 'xxx' } })
```

---

### 4. `src/lib/schema.ts` — หัวใจของ Phase 1

ไฟล์นี้ทำ 2 อย่างพร้อมกัน:
1. **ตรวจสอบข้อมูล (Validation)** — ก่อนบันทึกหรือโหลดจาก DB
2. **นิยามรูปร่าง (Type Definition)** — TypeScript อ่านจากที่นี่

```
FieldDefSchema         ← 1 field เช่น { id, name, dataType }
    ↓ ใช้ใน
TableSourceSchema      ← 1 table เช่น { id, name, type, fields[] }
    ↓ ใช้ใน
BuilderStateSchema     ← ทุกอย่างรวมกัน { tables[], conditions[], results[] }
```

**ส่วนที่ซับซ้อนที่สุด — FormulaNode:**
```typescript
type FormulaNode =
  | { type: 'field'; ref: FieldRef }          ← อ้างอิง field จาก table
  | { type: 'literal'; value: number|string } ← ค่าตรงๆ เช่น 100
  | { type: 'operation'; op: '+'; left: FormulaNode; right: FormulaNode }  ← บวก/ลบ
  | { type: 'percent'; node: FormulaNode }    ← คิดเป็น %
```

มันอ้างอิงตัวเองได้ (recursive) เพราะ formula ซ้อนกันได้ไม่จำกัดชั้น เช่น `(A + B) * C`

**ใช้ `parseBuilderState()` เสมอเมื่อโหลดจาก DB:**
```typescript
import { parseBuilderState } from '@/lib/schema'

const state = parseBuilderState(formula.state)  // แปลง unknown → BuilderState
```

---

### 5. `src/types/index.ts` — ทางลัด Import Type

ไม่มี logic อะไรเลย — แค่ re-export types ที่ infer มาจาก Zod schemas

```typescript
// แทนที่จะเขียน z.infer<typeof BuilderStateSchema> ทุกครั้ง
// import จากที่นี่เลย:
import type { BuilderState, Condition, FieldRef } from '@/types'
```

---

### 6. `prisma/seed.ts` — ใส่ข้อมูลตัวอย่างลง DB

รันด้วย `npx prisma db seed` — ใส่ Formula ตัวอย่างที่มี Table 1 (Revenue, Cost, Category) และ Table 2 (Quantity, Price, Label)

ใช้ DIRECT_URL เพราะ seed คือ CLI script ไม่ใช่ API runtime

---

## Data Flow ตั้งแต่ DB จนถึง UI (ภาพรวม)

```
Neon PostgreSQL (cloud)
        ↓
Prisma Client (db.ts)    ← คุยกับ DB ผ่าน PrismaNeon adapter
        ↓
Raw JSON (Formula.state)
        ↓
parseBuilderState()       ← ตรวจสอบและแปลง unknown → typed
        ↓
BuilderState              ← TypeScript type พร้อมใช้งาน
        ↓
tRPC → Zustand → UI       ← Phase 2-3 จะทำต่อ
```

---

## คำสั่งที่ใช้บ่อย

| ต้องการทำ | คำสั่ง |
|-----------|--------|
| ดึง DB credentials จาก Vercel | `vercel env pull .env.local` |
| สร้าง migration ใหม่ | `npx prisma migrate dev --name "ชื่อที่บอกว่าเปลี่ยนอะไร"` |
| ใส่ข้อมูลตัวอย่าง | `npx prisma db seed` |
| เปิด DB แบบ visual | `npx prisma studio` |
| Regenerate Prisma Client | `npx prisma generate` |
| ตรวจ TypeScript | `npx tsc --noEmit` |
| รัน Dev server | `npm run dev` |

---

## Environment Variables ที่ต้องมี

```bash
DATABASE_URL=   # pooled — ใช้กับ API runtime (db.ts)
DIRECT_URL=     # direct — ใช้กับ migration + seed
```

ดึงจาก Vercel: `vercel env pull .env.local` (ต้อง `vercel link` ก่อน)

---

## ข้อผิดพลาดที่มักเจอ

| Error | สาเหตุ | แก้ยังไง |
|-------|--------|----------|
| `DATABASE_URL is not set` | ยังไม่ได้ดึง .env.local | `vercel env pull .env.local` |
| `Cannot find module '@prisma/client'` | ยังไม่ได้ generate | `npx prisma generate` |
| `P3009 migrate found failed migrations` | migration ค้างอยู่ | `npx prisma migrate resolve` |
| Type error: `unknown is not BuilderState` | ลืม parse | ใช้ `parseBuilderState(raw)` |

---

## สิ่งที่ Phase 2 จะสร้างต่อจากนี้

Phase 1 วางรากฐานข้อมูลแล้ว Phase 2 จะสร้าง **tRPC Routers** ซึ่งเป็นชั้น API:

```
UI → tRPC (Phase 2) → db.ts (Phase 1) → Neon DB
```

ไฟล์ที่ Phase 2 จะสร้าง:
- `src/server/trpc.ts` — ตั้งค่า tRPC base
- `src/server/routers/formula.ts` — endpoint สำหรับ CRUD Formula
- `src/server/root.ts` — รวม routers ทั้งหมด
- `src/app/api/trpc/[trpc]/route.ts` — HTTP handler
- `src/lib/trpc/` — client-side setup

---

## Cheat Sheet — ลำดับ dependency

```
schema.prisma
    → prisma migrate dev → ตาราง Formula ใน DB
    → prisma generate   → Prisma Client types

src/lib/schema.ts        (Zod schemas)
    → z.infer<>          → src/types/index.ts (TypeScript types)
    → parseBuilderState  → ใช้ใน tRPC routers (Phase 2)

src/server/db.ts         (Prisma singleton)
    → import { db }      → ใช้ใน tRPC routers (Phase 2)
```

ถ้าแก้ `schema.prisma` → ต้อง migrate + generate ใหม่เสมอ
ถ้าแก้ `src/lib/schema.ts` → types ใน `src/types/index.ts` อัปเดตอัตโนมัติ
