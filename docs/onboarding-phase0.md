# Onboarding Guide — Condition Builder (Phase 0)

## Overview

Condition Builder คือ web app สำหรับสร้าง formula/rule แบบ drag & drop โดยไม่ต้องเขียน code ผู้ใช้เลือก fields จาก data sources หลายตัว กำหนด conditions (เปรียบเทียบ field กับ field หรือ literal) และสร้าง result formula เป็น visual tree ระบบ evaluate formula ฝั่ง server แล้ว return ผลลัพธ์

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS v4 + shadcn/ui | 4.x |
| UI Components | shadcn/ui (copied into repo) | 4.x |
| Drag & Drop | @dnd-kit/core + sortable | 6.x / 10.x |
| Client State | Zustand | 5.x |
| Server State | tRPC + TanStack Query | 11.x / 5.x |
| Validation | Zod (shared client + server) | 4.x |
| ORM | Prisma + @neondatabase/serverless | 7.x |
| Database | Vercel Postgres (Neon / PostgreSQL 16) | — |
| Serialization | superjson | 2.x |
| Testing | Vitest + Playwright | planned Phase 9 |
| Deploy | Vercel | — |

---

## Architecture Pattern

Full-stack monolith บน Next.js App Router — ไม่มี backend แยก tRPC routes อยู่ใน `src/app/api/trpc/[trpc]/route.ts` และ share Zod schemas กับ client โดยตรง

```
Browser
  └─ React (Client Components + Zustand)
       └─ tRPC Client + TanStack Query
            └─ HTTP POST /api/trpc/*
                 └─ tRPC Server (Next.js Route Handler)
                      └─ Prisma Client
                           └─ Vercel Postgres (Neon)
```

---

## Key Entry Points

| จุดเข้า | ไฟล์ | หมายเหตุ |
|---------|------|---------|
| App shell | `src/app/layout.tsx` | font, metadata, Phase 3 เพิ่ม Providers |
| Landing page | `src/app/page.tsx` | placeholder — Phase 3 แทนด้วย builder |
| Builder UI | `src/app/(builder)/page.tsx` | สร้างใน Phase 3 |
| API handler | `src/app/api/trpc/[trpc]/route.ts` | สร้างใน Phase 2 |
| DB schema | `prisma/schema.prisma` | models เพิ่มใน Phase 1 |
| Shared types | `src/lib/schema.ts` → `src/types/index.ts` | Phase 1 |
| Global state | `src/store/builder-store.ts` | Phase 3 |

---

## Directory Map

```
src/
├── app/               Next.js App Router — pages, layouts, API routes
├── components/
│   ├── builder/       Builder panels (Phase 4+): FieldPanel, ConditionPanel, etc.
│   ├── dnd/           Drag & drop primitives (Phase 5): DraggableField, DropZone
│   └── ui/            shadcn/ui — copied source, แก้ไขได้โดยตรง
├── lib/
│   ├── utils.ts       cn() class merging utility
│   ├── schema.ts      Zod schemas (Phase 1) — single source of truth
│   ├── formula-engine.ts   evaluate FormulaNode → result (Phase 8)
│   └── condition-evaluator.ts  (Phase 8)
├── server/
│   ├── db.ts          Prisma client singleton (Phase 1)
│   ├── trpc.ts        tRPC base router + procedure (Phase 2)
│   ├── root.ts        appRouter — merge all routers (Phase 2)
│   └── routers/       tRPC router files (Phase 2)
├── store/
│   └── builder-store.ts   Zustand BuilderState (Phase 3)
└── types/
    └── index.ts       TypeScript types — inferred จาก Zod (Phase 1)
```

---

## Request Lifecycle (Phase 2 เป็นต้นไป)

```
1. User แก้ไข UI → Zustand store update (optimistic)
2. useEffect + debounce 500ms → tRPC mutation fire
3. tRPC client serialize ด้วย superjson → POST /api/trpc/formula.upsert
4. Next.js route handler → tRPC server procedure
5. Zod validates input (shared schema)
6. Prisma write → Vercel Postgres
7. Response กลับมา confirm → Zustand state sync
```

---

## Conventions

**Imports** — path alias `@/*` เสมอ, ไม่ใช้ relative `../../../`

**Components** — Server Component by default, ใส่ `'use client'` เฉพาะเมื่อต้องการ hooks/events

**Class merging** — `cn()` จาก `@/lib/utils` ทุก component

**Types** — infer จาก Zod: `type X = z.infer<typeof XSchema>` ห้าม duplicate

**Commits** — conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

**Build** — `--webpack` flag ใน dev + build ห้ามลบออก (Turbopack ไม่รองรับ Node 24 + Windows)

---

## Common Tasks

```bash
npm run dev                    # dev server (webpack mode)
npx tsc --noEmit               # type check
npm run lint                   # eslint
vercel env pull .env.local     # ดึง DB credentials จาก Vercel
npx prisma migrate dev         # สร้าง + apply migration (Phase 1+)
npx prisma studio              # visual DB browser
npm run test                   # Vitest unit tests (Phase 9)
npm run test:e2e               # Playwright E2E (Phase 9)
```

---

## Where to Look

| ต้องการทำอะไร | ดูที่ไหน |
|--------------|---------|
| เพิ่ม DB model | `prisma/schema.prisma` |
| เพิ่ม/แก้ Zod type | `src/lib/schema.ts` |
| เพิ่ม tRPC endpoint | `src/server/routers/*.ts` → register ใน `root.ts` |
| เพิ่ม UI component (shadcn) | `src/components/ui/` |
| เพิ่ม builder panel | `src/components/builder/` |
| แก้ global state | `src/store/builder-store.ts` |
| แก้ design tokens | `src/app/globals.css` `:root` block |
| เพิ่ม formula operation | `src/lib/formula-engine.ts` (Phase 8) |

---

## Phase 0 Gotchas

1. **Placeholder files** — `schema.ts`, `db.ts`, `builder-store.ts`, `types/index.ts` เป็นแค่ `export {}` ตอนนี้ — อย่า import อะไรจากไฟล์เหล่านี้จนกว่า Phase 1 จะ populate
2. **Tailwind v4** — ไม่มี `tailwind.config.ts` config อยู่ใน CSS (`@theme inline`) เท่านั้น
3. **shadcn/ui** — source code อยู่ใน repo เลย (`src/components/ui/`) ไม่ใช่ external package — `npx shadcn add` จะ append ไฟล์ใหม่เข้ามา
4. **DATABASE_URL** — ยังไม่มี `.env.local` ต้องรัน `vercel env pull .env.local` ก่อนเริ่ม Phase 1
