# GUIDELINE.md — คู่มือรับช่วงต่อโปรเจกต์ Condition Builder (Step-by-Step)

> สำหรับ Developer ที่เพิ่งเข้ามา / ทีม Support / หรือคนที่ต้องเอาโค้ดนี้ไปแก้ต่อด้วย AI IDE ตัวอื่น
> ทำตามทีละ STEP จากบนลงล่าง อ่านไฟล์นี้เป็นไฟล์แรกก่อนเปิดโค้ด

---

## STEP 0 — เข้าใจว่าโปรเจกต์นี้คืออะไร (2 นาที)

Condition Builder คือ web app ที่ให้ผู้ใช้ **สร้างสูตร/เงื่อนไขแบบลาก-วาง** โดยไม่ต้องเขียนโค้ด คล้าย Excel แต่เป็น visual ทั้งหมด ผู้ใช้เลือก field จากหลาย table มากำหนดเงื่อนไข (เช่น `Table1.Price > 100`) และสร้างสูตร (เช่น `(Price + Tax) × Qty`) แล้วกด RUN ดูผลลัพธ์

จำ 3 แนวคิดนี้ไว้ก่อน เดี๋ยวจะเจอซ้ำตลอด:

1. **State เก็บเป็น JSON ก้อนเดียว** — DB มีตารางเดียวชื่อ `Formula` คอลัมน์ `state` (JSONB) เก็บทุกอย่าง (tables, conditions, results) ไม่ต้อง JOIN
2. **สูตรเก็บเป็น Tree (AST) ไม่ใช่ String** — `(A + B) × C` เก็บเป็นต้นไม้ข้อมูล evaluate/render/validate ได้โดยไม่ต้อง parse
3. **Type เดียวใช้ทั้ง client + server** — `src/lib/schema.ts` (Zod) เป็นแหล่งความจริงเดียว, types ทั้งหมด infer มาจากที่นี่, tRPC ทำให้ API type-safe ตลอดสาย

---

## STEP 1 — เข้าใจภาพ Data Flow ทั้งระบบ (3 นาที)

ทุกอย่างไหลทางเดียวกันหมด จำ flow นี้ได้ = เข้าใจ 80% ของระบบ:

```
ผู้ใช้แก้ UI
   ↓
Zustand store อัปเดต + ตั้ง isDirty = true       [src/store/builder-store.ts]
   ↓
useAutoSave รอ 500ms (debounce)                  [src/hooks/use-auto-save.ts]
   ↓
tRPC mutation: formula.upsert                    [src/lib/trpc/ → src/server/routers/formula.ts]
   ↓
Prisma Client (ผ่าน adapter)                     [src/server/db.ts]
   ↓
PostgreSQL (ปัจจุบัน Neon / Vercel Postgres)     [prisma/schema.prisma]
```

ตอนกด RUN จะแยกออกไปอีกเส้น: ส่ง state + mock data → `formula.evaluate` (server) → คำนวณด้วย pure function (`formula-engine.ts`, `condition-evaluator.ts`) → return ผลกลับมาแสดงใน PreviewBox **ไม่แตะ DB เลย**

---

## STEP 2 — ติดตั้งและรันให้ขึ้นในเครื่อง

ทำตามทีละบรรทัด:

```bash
# 2.1 ติดตั้ง dependencies
npm install

# 2.2 ตั้งค่า env (เลือกอย่างใดอย่างหนึ่ง)
vercel env pull .env.local         # ถ้ามีสิทธิ์ Vercel (ต้อง vercel link ก่อน)
# หรือ: copy .env.example เป็น .env.local แล้วกรอกค่าเอง (ดู STEP 6)

# 2.3 เตรียมฐานข้อมูล
npx prisma generate                # สร้าง Prisma Client
npx prisma migrate dev             # apply migrations
npx prisma db seed                 # ใส่ข้อมูลตัวอย่าง

# 2.4 รัน dev server
npm run dev                        # เปิด http://localhost:3000/builder
```

**เช็คว่าสำเร็จ:** เปิด `/builder` → กด "Add Field +" → เพิ่ม field → รอ 1 วินาที → เห็นคำว่า "Saved" ที่หัวจอ = ทุกชั้นทำงานครบ (UI → store → auto-save → tRPC → DB)

> ⚠️ `dev` และ `build` ใช้ flag `--webpack` เสมอ **ห้ามลบ** — Turbopack ยังไม่รองรับ Node 24 บน Windows

---

## STEP 3 — อ่าน onboarding docs ตามลำดับ phase

โปรเจกต์สร้างเป็น 10 phase แต่ละ phase มี doc ภาษาชาวบ้านใน `docs/` อ่านตามลำดับจะเห็นว่าแต่ละชั้นถูกสร้างซ้อนขึ้นมายังไง

**ลำดับที่ต้องอ่าน (ห้ามข้าม):**

1. `docs/onboarding-phase0.md` — ภาพรวม + directory map + request lifecycle
2. `docs/onboarding-phase1.md` — Data Layer (Prisma + Zod + types)
3. `docs/onboarding-phase2.md` — API Layer (tRPC routers)
4. `docs/onboarding-phase3.md` — Frontend Foundation (Provider, Store, Auto-save)

อ่าน 4 ตัวนี้จบ = เข้าใจ data flow ทั้งสาย (DB → API → UI) **แล้วค่อยอ่าน phase ที่เกี่ยวกับงานที่จะทำ:**

5. `docs/ONBOARDING-PHASE4.md` — Field Panel
6. `docs/ONBOARDING-PHASE5.md` — Drag & Drop
7. `docs/ONBOARDING-PHASE6.md` — Condition Panel
8. `docs/ONBOARDING-PHASE7.md` — Result / Formula Panel (AST)
9. `docs/ONBOARDING-PHASE8.md` — Formula Engine + RUN
10. `docs/ONBOARDING-PHASE9.md` — Testing

> เปิด Code Tour แบบ interactive ได้ที่ `.tours/*.tour` (ติดตั้ง VS Code extension **CodeTour**)
> ก่อน debug อะไร เช็ค `docs/post-mortem-phase-*.md` ก่อน — บั๊กหลายตัวเคยแก้ไปแล้ว อย่าทำซ้ำ

---

## STEP 4 — จะแก้อะไร เปิดไฟล์ไหน (lookup table)

หาแถวที่ตรงกับงาน แล้วเปิดไฟล์นั้น:

| อยากแก้... | เปิดไฟล์ | หมายเหตุ |
|---|---|---|
| รูปร่างข้อมูล / validation | `src/lib/schema.ts` | แก้ที่นี่ที่เดียว types จะตามไปเองที่ `src/types/index.ts` |
| DB model | `prisma/schema.prisma` | ต้อง `migrate dev` + `generate` ใหม่เสมอ |
| API endpoint | `src/server/routers/formula.ts` | register ใน `src/server/root.ts` |
| global state / actions | `src/store/builder-store.ts` | ทุก action ต้องตั้ง `isDirty = true` |
| logic คำนวณสูตร | `src/lib/formula-engine.ts` | |
| logic เช็คเงื่อนไข | `src/lib/condition-evaluator.ts` | |
| UI แต่ละ panel | `src/components/builder/*Panel.tsx` | |
| Drag & Drop | `src/components/dnd/` | |
| design tokens / สี | `src/app/globals.css` (`:root`) | |

---

## STEP 5 — เขียนโค้ดให้ถูก convention (กฎที่ห้ามพลาด)

ก่อนเขียนทุกครั้ง เช็ค checklist นี้:

- [ ] ใช้ path alias `@/*` ไม่ใช่ relative path (`@/lib/utils` ไม่ใช่ `../../lib/utils`)
- [ ] Server Component เป็น default — ใส่ `'use client'` เฉพาะที่ต้องใช้ hooks/events
- [ ] Type infer จาก Zod เสมอ ห้าม duplicate type ด้วยมือ
- [ ] Immutable update เท่านั้น — สร้าง object ใหม่ ห้ามแก้ของเดิม (Zustand ตรวจ change ด้วย reference)
- [ ] แปลง user input ด้วย Zod `safeParse` ห้าม cast ด้วย `as` (เคยเป็นบั๊ก Phase 6/7)
- [ ] แปลง string → number ด้วย `toNumber()` ใน `formula-engine.ts` เท่านั้น ไม่ใช่ `Number()`/`parseInt()`
- [ ] เพิ่ม operator/node type ใหม่ → ต้องเพิ่ม case ใน switch ด้วย (มี exhaustive `never` guard คอยจับ)
- [ ] DropZone `id` ต้อง unique ทั้งหน้า
- [ ] commit แบบ conventional: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

**ก่อน commit ทุกครั้ง รันให้ผ่านครบ 4 อย่าง:**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

---

## STEP 6 — ตั้งค่า Environment Variables

ฐานข้อมูลปัจจุบันคือ Neon ต้องการ 2 ตัวแปร:

```bash
# Pooled — ใช้โดย Prisma Client ตอน runtime (src/server/db.ts)
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.region.aws.neon.tech/DB?sslmode=require"

# Direct — ใช้โดย Prisma Migrate + seed (bypass pooler)
DIRECT_URL="postgresql://USER:PASSWORD@HOST.region.aws.neon.tech/DB?sslmode=require"
```

ทำไม 2 ตัว? `DATABASE_URL` เป็น pool เหมาะกับ API serverless ที่เปิด-ปิด connection บ่อย, `DIRECT_URL` เป็น connection ตรง จำเป็นสำหรับ migration/seed ที่ต้องการ connection ต่อเนื่อง

---

## STEP 7 — เปลี่ยน Database (เช่น Neon → Supabase)

ข่าวดี: โปรเจกต์ใช้ **Prisma driver adapter** และมี `@prisma/adapter-pg` + `pg` ติดตั้งไว้แล้ว ไม่ต้องลง dependency เพิ่ม ทำ 3 ขั้น:

### 7.1 เปลี่ยน connection string ใน `.env.local`

เอา URL จาก Supabase Dashboard → Project Settings → Database → Connection string

```bash
# Pooled (Supabase port 6543 + pgbouncer) — runtime
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Direct (port 5432) — migration + seed
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

### 7.2 สลับ adapter ใน `src/server/db.ts`

เปลี่ยนจาก `PrismaNeon` เป็น `PrismaPg` (generic ใช้ได้กับ Postgres ทุกเจ้า รวม Supabase):

```typescript
// เดิม
import { PrismaNeon } from '@prisma/adapter-neon'
const adapter = new PrismaNeon({ connectionString })

// เปลี่ยนเป็น
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString })
```

ส่วนที่เหลือใน `db.ts` (singleton + hot-reload guard) **ไม่ต้องแตะ**

### 7.3 apply schema ไปที่ DB ใหม่

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed        # optional
```

เสร็จ — `prisma/schema.prisma` ยังเป็น `provider = "postgresql"` เหมือนเดิม ไม่ต้องแก้ เพราะ Supabase ก็คือ Postgres

> **ถ้าย้ายไป DB ที่ไม่ใช่ Postgres** (MySQL/SQLite): ต้องแก้ `provider` ใน `schema.prisma` + เปลี่ยน adapter + ระวังคอลัมน์ `state` ที่เป็น JSONB — แนะนำให้อยู่กับ Postgres provider จะ migrate ง่ายสุด
> **ถ้า pooler มีปัญหา prepared statement:** ใส่ `pgbouncer=true` ใน `DATABASE_URL` (ใส่ในตัวอย่างแล้ว) ส่วน `DIRECT_URL` ใช้ port 5432 ที่ไม่ผ่าน pooler

---

## STEP 8 — เอาโค้ดไปแก้ต่อด้วย AI IDE ตัวอื่น (Cursor / Windsurf / Copilot)

### 8.1 Prime context — สั่ง AI อ่าน 3 ไฟล์นี้ก่อนเสมอ
- `CLAUDE.md` (root) — tech stack, conventions, design decisions
- `GUIDELINE.md` (ไฟล์นี้) — แผนที่ทั้งโปรเจกต์
- `docs/onboarding-phase0.md` — directory map + lifecycle

### 8.2 ถามเรื่อง feature ไหน แนบ doc ของ phase นั้น
เช่นจะแก้ condition → แนบ `docs/ONBOARDING-PHASE6.md` (มี file path + บรรทัด + gotcha ครบ AI จะไม่เดา)

### 8.3 ย้าย convention เข้าไฟล์ rules ของ IDE ใหม่
ก๊อปสาระจาก `CLAUDE.md` (Conventions + Design Decisions) และ checklist ใน STEP 5 ของไฟล์นี้ ไปใส่:
- Cursor → `.cursorrules`
- Windsurf → `.windsurfrules`
- Copilot → `.github/copilot-instructions.md`

### 8.4 เตือน AI เรื่องที่มันมักพลาด
ก๊อป checklist STEP 5 ใส่ใน prompt — โดยเฉพาะ `safeParse` (ไม่ใช่ `as`), `toNumber()` (ไม่ใช่ `Number()`), และ exhaustive switch guard

### 8.5 ให้ AI รัน gate ก่อนถือว่าเสร็จ
```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

---

## สรุป Quick Reference

```bash
npm run dev               # dev server (webpack)
npx tsc --noEmit          # type check
npm run lint              # eslint
npm run test              # unit tests (Vitest)
npm run test:coverage     # + coverage (threshold 80%)
npm run test:e2e          # E2E (Playwright)
npm run build             # production build
npx prisma studio         # ดู DB แบบ visual
npx prisma migrate dev    # สร้าง + apply migration
```

ลำดับทำงานสรุป: **STEP 2 (รันให้ขึ้น) → STEP 3 (อ่าน phase 0-3) → STEP 4 (หาไฟล์ที่จะแก้) → STEP 5 (เขียนตาม convention) → gate ก่อน commit**
</content>
