# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ภาพรวมโปรเจกต์

**Condition Builder** คือ Web Application สำหรับสร้าง Formula / Rule แบบ Dynamic ผ่าน UI ที่ Drag & Drop ได้ ผู้ใช้สามารถเลือก Fields จาก Data Source หลายตัว (Table 1, Table 2, Custom) กำหนด Condition (เงื่อนไขเปรียบเทียบ) และสร้าง Result Formula แบบ Visual โดยไม่ต้องเขียน Code

### โครงสร้างหน้าจอหลัก (จาก Mockup)

```
┌─────────────────────────────────────────────────────┐
│ Condition Builder                          [RUN]     │
├─────────────────────────────────────────────────────┤
│ [Add Field +]                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Table 1  [+] │  │ Table 2  [x] │  │ Custom[x]│  │
│  │ Field 1      │  │ Field 1      │  │          │  │
│  │ Field 2      │  │ Field 2      │  │          │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
├─────────────────────────────────────────────────────┤
│ Condition [+]                                        │
│  ① [Table1-Field1] ─(+)─ [Table2-Field1]   [x]     │
│                    ┌ Equal                           │
│                    │ More Than                       │
│                    └ Less Than                       │
├─────────────────────────────────────────────────────┤
│ Actions [+]                                         │
│  ─ [New Field] / [Select Field]                     │
├─────────────────────────────────────────────────────┤
│ Result                                              │
│  [Result1] ─(⊕)─ [Table1.Field1] ─(+)─ [Percent]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│            Preview / Output Box                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** |
| Styling | **Tailwind CSS v4 + shadcn/ui** |
| Drag & Drop | **@dnd-kit/core + @dnd-kit/sortable** |
| Client State | **Zustand** |
| Server State | **tRPC + TanStack Query** |
| Validation | **Zod** (shared client/server) |
| ORM | **Prisma** |
| Database | **Vercel Postgres (PostgreSQL 16)** |
| Testing | **Vitest + Playwright** |
| Deploy | **Vercel** |

---

## Commands

```bash
# Dev server
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Prisma
npx prisma generate          # regenerate client after schema change
npx prisma migrate dev       # create + apply migration
npx prisma migrate deploy    # apply migrations in production
npx prisma studio            # visual DB browser

# Connect Vercel Postgres (ต้อง vercel link ก่อน)
vercel env pull .env.local

# Test
npm run test                 # Vitest unit tests
npm run test:e2e             # Playwright E2E
npx vitest run src/lib/formula-engine.test.ts  # single file
```

---

## โครงสร้าง Project

```
condition-builder/
├── prisma/
│   └── schema.prisma            # DB models
├── src/
│   ├── app/
│   │   ├── (builder)/           # builder route group
│   │   │   └── page.tsx         # Builder หน้าหลัก
│   │   ├── api/trpc/[trpc]/
│   │   │   └── route.ts         # tRPC HTTP handler
│   │   ├── layout.tsx
│   │   └── page.tsx             # Landing / redirect
│   ├── server/
│   │   ├── routers/             # tRPC routers (Phase 2)
│   │   ├── trpc.ts              # tRPC init
│   │   ├── root.ts              # appRouter
│   │   └── db.ts                # Prisma client singleton
│   ├── components/
│   │   ├── builder/             # Builder panels (Phase 3+)
│   │   │   ├── FieldPanel.tsx
│   │   │   ├── ConditionPanel.tsx
│   │   │   ├── ActionPanel.tsx
│   │   │   ├── ResultPanel.tsx
│   │   │   └── PreviewBox.tsx
│   │   ├── dnd/                 # Drag & drop primitives (Phase 4)
│   │   │   ├── DraggableField.tsx
│   │   │   └── DropZone.tsx
│   │   └── ui/                  # shadcn/ui auto-generated
│   ├── lib/
│   │   ├── trpc/                # tRPC client + provider
│   │   ├── formula-engine.ts    # Evaluate FormulaNode → result (Phase 7)
│   │   ├── condition-evaluator.ts
│   │   └── schema.ts            # Zod schemas (shared)
│   ├── store/
│   │   └── builder-store.ts     # Zustand store
│   └── types/
│       └── index.ts             # Shared TypeScript types
├── .env.example                 # Template — copy → .env.local
└── CLAUDE.md
```

---

## Architecture Overview

### Data Model หลัก

```typescript
// Data Sources
type TableSource = {
  id: string
  name: string              // "Table 1", "Table 2", "Custom"
  type: 'table' | 'custom'
  fields: FieldDef[]
}

type FieldDef = {
  id: string
  name: string
  dataType: 'number' | 'string' | 'boolean'
}

// Field Reference — ใช้ใน Condition และ Formula
type FieldRef = {
  tableId: string
  fieldId: string
  label: string             // "Table1.Field1"
}

// Condition
type Operator = 'equal' | 'greater_than' | 'less_than' | 'not_equal' | 'contains'

type Condition = {
  id: string
  left: FieldRef
  operator: Operator
  right: FieldRef | LiteralValue
}

// Formula AST — tree structure
type FormulaNode =
  | { type: 'field'; ref: FieldRef }
  | { type: 'literal'; value: number | string }
  | { type: 'operation'; op: '+' | '-' | '*' | '/' | '%'; left: FormulaNode; right: FormulaNode }
  | { type: 'percent'; node: FormulaNode }

type ResultFormula = {
  id: string
  name: string              // "Result1"
  expression: FormulaNode
}

// Global Builder State (Zustand + persisted to DB)
type BuilderState = {
  tables: TableSource[]
  conditions: Condition[]
  results: ResultFormula[]
}
```

### Key Patterns

**Auto-save** — ทุก mutation ผ่าน tRPC mutation พร้อม optimistic update ใน Zustand → confirm จาก server (debounce 500ms)

**Formula เป็น AST ไม่ใช่ String** — เก็บ `FormulaNode` tree ใน DB เป็น JSONB ทำให้ evaluate, serialize, render แบบ visual ได้โดยไม่ต้อง parse string

**Drag & Drop** — `DndContext` ครอบ layout ทั้งหมด, `useDraggable` ที่ field chip, `useDroppable` ที่ slot ใน Condition/Formula rows

**Formula Engine อยู่ฝั่ง Server** — `POST /api/trpc/formula.evaluate` รับ BuilderState + data context → return result (engine ใกล้ PG data)

---

## Environment Variables

```bash
DATABASE_URL=    # Vercel Postgres connection string (pooled)
DIRECT_URL=      # Direct connection สำหรับ Prisma migrations
```

ดึง env จาก Vercel: `vercel env pull .env.local`

---

## Design Decisions

**Next.js แทน Vite + Fastify แยก** — single app บน Vercel, tRPC adapter built-in, ไม่ต้อง manage 2 services

**tRPC แทน REST** — end-to-end type safety, Zod schema เดียวใช้ทั้ง client/server, ไม่ต้อง duplicate types

**Zustand แทน Redux** — Formula tree update บ่อยจาก drag & drop, boilerplate น้อยกว่า, performance เพียงพอ

**Vercel Postgres (Neon)** — รองรับ connection pooling สำหรับ serverless functions โดยไม่ต้อง config เพิ่ม

---

## Phase Status (อัปเดต Phase 0)

| File / Directory | สถานะ | Populate ใน |
|---|---|---|
| `src/app/layout.tsx` | ✅ Font + HTML shell พร้อม | Phase 3 เพิ่ม Providers |
| `src/app/globals.css` | ✅ Tailwind v4 + design tokens | ใช้ได้ทุก phase |
| `src/components/ui/` | ✅ shadcn/ui 9 components | ใช้ได้ทุก phase |
| `src/lib/utils.ts` | ✅ `cn()` utility | ใช้ได้ทุก phase |
| `prisma/schema.prisma` | ⬜ provider only, ยังไม่มี models | Phase 1 |
| `src/server/db.ts` | ⬜ placeholder | Phase 1 |
| `src/lib/schema.ts` | ⬜ placeholder | Phase 1 |
| `src/types/index.ts` | ⬜ placeholder | Phase 1 |
| `src/store/builder-store.ts` | ⬜ placeholder | Phase 3 |

---

## Conventions

**Imports** — ใช้ path alias `@/*` แทน relative path เสมอ (`@/lib/utils` ไม่ใช่ `../../lib/utils`)

**Components** — Server Component by default, เพิ่ม `'use client'` เมื่อต้องการ browser API / event handlers / hooks

**Styling** — ใช้ `cn()` จาก `@/lib/utils` ทุก component สำหรับ conditional + merged Tailwind classes

**Commits** — conventional commits format: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

**Build flag** — `--webpack` ทั้งใน `dev` และ `build` script ห้ามลบออก (Turbopack ไม่รองรับ Node 24 + Windows)
