# Post-mortem: Phase 9 — Polish + Testing

> เขียนหลัง fix ครบทุกตัว | ภาษาชาวบ้าน เข้าใจง่าย | ใช้ทบทวนก่อนทำ Phase ถัดไป

---

## ภาพรวม

Phase 9 คือ Phase สุดท้ายของ Condition Builder — ติดตั้ง Vitest (unit test) + Playwright (E2E test) แล้ว run ให้ผ่านทั้งหมด จากนั้น build production ให้สำเร็จ

พบ Bug และ Gap ทั้งหมด **9 ตัว** แบ่งเป็น:

| หมวด | จำนวน |
|------|-------|
| Config Bug (ตั้งค่าผิด) | 5 |
| Test Logic Bug | 2 |
| Architecture Bug (โค้ดอยู่ผิดที่) | 1 |
| Accessibility Bug | 1 |

ผลสุดท้าย: **67 unit tests ผ่าน**, **18/18 E2E ผ่าน (Chromium + WebKit)**, build clean

---

## Bug 1 — `environmentMatchGlobs` ไม่มีใน Vitest 4

### เกิดอะไรขึ้น

ตั้งค่า `vitest.config.ts` ไว้แบบนี้:

```ts
test: {
  environmentMatchGlobs: [
    ['src/**/*.test.tsx', 'jsdom'],  // component tests → browser env
    ['src/**/*.test.ts',  'node'],   // lib tests → Node env
  ]
}
```

TypeScript บ่นทันที: `TS2769: No overload matches this call` — เพราะ `environmentMatchGlobs` ถูก **ลบออกจาก Vitest 4** ไปแล้ว ไม่มี type นี้อีก

### ทำไมถึงพลาด

ดูเอกสารเก่า (Vitest 3) และนำ option มาใส่โดยไม่ตรวจสอบกับ version ที่ติดตั้งจริง

### เปรียบเหมือน

เหมือนกดปุ่ม "เปิด window" ในรถที่ย้ายปุ่มไปที่อื่นแล้ว กดแล้วไม่มีอะไรเกิดขึ้นหรือกดผิดปุ่มอื่น

### Fix

ลบ `environmentMatchGlobs` ออก ใช้แค่:

```ts
environment: 'node'  // global สำหรับ lib tests ทั้งหมด
```

พอจะมี component tests เพิ่ม jsdom ให้เปลี่ยน environment ตรงนั้น

### บทเรียน

ก่อนใช้ config option ใหม่ ให้ดูเอกสารของ **version จริงที่ติดตั้ง** ไม่ใช่ Google แล้วเอา snippet แรกที่เจอ

---

## Bug 2 — `expect is not defined` ใน setup.ts

### เกิดอะไรขึ้น

`src/test/setup.ts` มีบรรทัดนี้:

```ts
import '@testing-library/jest-dom'
```

แค่ import ก็ทำให้ test ทุกไฟล์ crash ด้วย:
```
ReferenceError: expect is not defined
```

### ทำไม

`@testing-library/jest-dom` เรียก `expect.extend(...)` ทันทีตอน import — มันต้องการ `expect` เป็น global variable

แต่ `vitest.config.ts` ตั้ง `globals: false` ไว้ — Vitest จึง **ไม่ inject** `expect`, `it`, `describe` เข้า global scope ต้อง `import { expect } from 'vitest'` ในแต่ละไฟล์เอง

### เปรียบเหมือน

เหมือนปลั๊กอิน AC ต่างประเทศที่ต้องการปลั๊ก 3 ขา แต่บ้านเรามีแค่ 2 รู — ต่อตรงๆ ไม่ได้ ต้องมี adapter ก่อน

### Fix

Comment out ไว้ก่อน (ยังไม่มี component tests):

```ts
// import '@testing-library/jest-dom'  ← enable เมื่อมี component tests + globals: true
```

### บทเรียน

Library ที่ทำงานกับ Jest อาจทำงานแตกต่างกับ Vitest ในโหมด `globals: false` — ตรวจสอบก่อนติดตั้งว่า library นั้นต้องการ global `expect` หรือเปล่า

---

## Bug 3 — Vitest รัน E2E test โดยไม่ตั้งใจ

### เกิดอะไรขึ้น

Vitest พยายามรัน `e2e/builder.spec.ts` ซึ่งเป็นไฟล์ Playwright แล้ว error แปลกๆ ออกมา เพราะ Playwright `test()` ≠ Vitest `test()`

### ทำไม

`vitest.config.ts` ตอนแรกไม่ได้กำหนด `include` pattern — Vitest จึงสแกน **ทุกไฟล์** ที่ชื่อมี `.test.` หรือ `.spec.` รวมถึงโฟลเดอร์ `e2e/` ด้วย

### เปรียบเหมือน

เหมือนแม่บ้านที่รับคำสั่ง "ทำความสะอาดทุกห้อง" แล้วเข้าไปจัดห้องเซิร์ฟเวอร์ด้วย ซึ่งไม่ใช่ห้องที่ควรแตะ

### Fix

```ts
test: {
  include:  ['src/**/*.test.{ts,tsx}'],  // เฉพาะใน src/ เท่านั้น
  exclude:  ['e2e/**', 'node_modules/**'],
}
```

### บทเรียน

ถ้าโปรเจกต์มี **2 test frameworks** (Vitest + Playwright) ต้องกำหนด scope ของแต่ละตัวให้ชัด ไม่งั้นมันจะเดินเข้าห้องกันเอง

---

## Bug 4 — Firefox Crash บน Windows Local

### เกิดอะไรขึ้น

รัน `npm run test:e2e` แล้ว Firefox fail ทุก test ด้วย:
```
Error: spawn UNKNOWN
```

Chromium และ WebKit ผ่านปกติ

### ทำไม

Playwright's headless Firefox ต้องการ **Microsoft Visual C++ Runtime (VC++ libs)** ที่ติดตั้งในระดับ OS — เครื่อง Windows local ของเราไม่มี แต่ CI server (Linux) มีพร้อม

ปัญหาคือ `playwright.config.ts` ใส่ Firefox ไว้ใน `projects` array เสมอ ไม่ว่าจะรันที่ไหน

### เปรียบเหมือน

เหมือนสั่งให้ mechanic ตรวจรถทุกระบบรวมถึงระบบที่ยังไม่ได้ติดตั้งในรถคันนี้ ผลคือ error ตั้งแต่ต้น

### Fix

```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  // Firefox เปิดเฉพาะ CI — Windows local ไม่มี VC++ libs
  ...(process.env.CI ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
],
```

### บทเรียน

Environment ของ local dev กับ CI server ต่างกัน — browser tests ที่ต้องการ system-level dependencies ควรเป็น CI-only และ config ต้องสะท้อนความจริงนี้

---

## Bug 5 — `vite-tsconfig-paths` Plugin ซ้ำซ้อน

### เกิดอะไรขึ้น

ติดตั้ง `vite-tsconfig-paths` เพื่อให้ Vitest resolve `@/` path aliases (เช่น `@/lib/schema`) ได้ถูกต้อง

แต่จริงๆ แล้ว **Vite 6 มี built-in** อยู่แล้ว: `resolve.tsconfigPaths: true` — plugin นี้เลย**ไม่จำเป็น**

### เปรียบเหมือน

เหมือนซื้อ adapter ราคาแพงมาเสียบโทรศัพท์ ทั้งที่โทรศัพท์มี port ที่ต้องการอยู่แล้ว แค่ไม่รู้ว่ามี

### Fix

```ts
// vitest.config.ts
resolve: {
  tsconfigPaths: true,  // native Vite 6 — ไม่ต้องติดตั้ง plugin เพิ่ม
},
```

### บทเรียน

ก่อนติดตั้ง plugin ใดๆ ตรวจ changelog ของ framework version ที่ใช้ก่อน — feature หลายอย่างถูก internalize เข้ามาใน core แล้ว

---

## Bug 6 — `test-results/` ถูก Commit โดยไม่ตั้งใจ

### เกิดอะไรขึ้น

Playwright สร้างโฟลเดอร์ `test-results/` เพื่อเก็บ error screenshot และ artifacts ตอน test fail — แต่โฟลเดอร์นี้ถูก commit เข้า git ไปด้วยในคราวเดียวกับโค้ด

### ทำไม

`.gitignore` ยังไม่มี `/test-results` และ `/playwright-report` ตอน commit แรก ไฟล์พวกนี้เลย untracked → ถูก `git add` ไปด้วย

### เปรียบเหมือน

เหมือนส่งไฟล์งานให้หัวหน้า แต่แนบ scratch paper และกระดาษทดไปด้วยในซอง ไม่ใช่สิ่งที่ควรส่ง

### Fix

```bash
git rm -r --cached test-results/     # เอาออกจาก tracking โดยไม่ลบไฟล์
```

```
# .gitignore
/test-results
/playwright-report
```

### บทเรียน

เมื่อติดตั้ง test framework ใหม่ ให้ **อัปเดต `.gitignore` ก่อน** run test ครั้งแรก ไม่ใช่หลัง

---

## Bug 7 — Access `issues[0]` โดยไม่มี Guard

### เกิดอะไรขึ้น

Test ใน `schema.test.ts` เขียนแบบนี้:

```ts
const result = ResultFormulaSchema.safeParse({ /* ... */ })
expect(result.success).toBe(false)
// ❌ อันตราย — ไม่รู้ว่า issues มีอย่างน้อย 1 ตัวไหม
expect(result.error.issues[0].message).toContain('maximum depth')
```

ถ้า Zod return `issues = []` (array ว่าง) โค้ดจะ crash ด้วย `TypeError: Cannot read properties of undefined` แทนที่จะ fail อย่างชัดเจน

### เปรียบเหมือน

เหมือนหยิบของชิ้นแรกจากกล่องโดยไม่เช็คก่อนว่ากล่องมีของอยู่ไหม ถ้ากล่องว่างก็มือแว้บไปเฉยๆ

### Fix

```ts
expect(result.success).toBe(false)
if (!result.success) {
  expect(result.error.issues).toHaveLength(1)      // เช็คว่ามีอย่างน้อย 1 ก่อน
  expect(result.error.issues[0].message).toContain('maximum depth')
}
```

### บทเรียน

`array[0]` บน array ที่อาจว่าง คือ runtime crash ที่ซ่อนอยู่ — assert ความยาวก่อนเสมอ

---

## Bug 8 — Dismiss Logic อยู่ผิดที่ (Architecture)

### เกิดอะไรขึ้น

Logic "หลังจาก save สำเร็จ 2 วิ ให้ซ่อน badge 'Saved'" อยู่ใน `BuilderShell.tsx` ซึ่งเป็น component ที่แสดง UI

```tsx
// ❌ ใน BuilderShell.tsx — มันรู้เรื่อง save lifecycle มากเกินไป
useEffect(() => {
  if (saveStatus !== 'saved') return
  const t = setTimeout(() => setSaveStatus('idle'), 2000)
  return () => clearTimeout(t)
}, [saveStatus])
```

### ปัญหาคืออะไร

`saveStatus` เป็น state ที่ **`useAutoSave` hook เป็นเจ้าของ** — ถ้า dismiss logic อยู่ใน component ที่ต่างกัน และวันหนึ่ง `SaveIndicator` มี 2 instance บน screen ในเวลาเดียวกัน ทั้งคู่จะ race กันเซ็ต `setSaveStatus('idle')` ให้ผลลัพธ์ไม่แน่นอน

### เปรียบเหมือน

เหมือนให้พนักงาน 2 คนปิดประตูเดียวกัน คนหนึ่งเปิด คนหนึ่งปิด ไม่มีใครรู้ว่าประตูจะอยู่สถานะไหนในตอนท้าย

### Fix

ย้าย logic ไปอยู่ใน `useAutoSave.ts` — เจ้าของ state lifecycle ตัวจริง:

```ts
// ✅ ใน useAutoSave.ts
useEffect(() => {
  if (saveStatus !== 'saved') return
  dismissRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISMISS_MS)
  return () => { if (dismissRef.current) clearTimeout(dismissRef.current) }
}, [saveStatus, setSaveStatus])
```

`SaveIndicator` กลายเป็น pure display component — รับค่ามาแสดง ไม่ยุ่งกับ state lifecycle

### บทเรียน

State ที่เป็น "lifecycle" ของ feature ควรอยู่ในที่เดียว (hook) — component ที่แสดง UI แค่อ่านค่า ไม่ควรเปลี่ยนค่าด้วยตัวเอง

---

## Bug 9 — Section Heading เป็น `<span>` แทน `<h2>`

### เกิดอะไรขึ้น

ทุก panel (Field, Condition, Action, Result, Preview) ใช้ `<span>` สำหรับ heading:

```tsx
// ❌ ก่อนแก้
<span id="field-heading" className="text-sm font-medium text-zinc-700">
  Fields
</span>
```

### ปัญหาคืออะไร

Screen reader (โปรแกรมอ่านหน้าจอสำหรับผู้พิการทางสายตา) ไม่รู้ว่า `<span>` นี้คือ heading ของ section — มันแค่อ่านเป็น "Fields" ธรรมดาๆ โดยไม่มี context ว่านี่คือชื่อของ section ต่อๆ ไป

WCAG AA standard กำหนดว่า landmark region ต้องมี heading ที่ถูกต้อง

### เปรียบเหมือน

เหมือนหนังสือที่หน้าแรกของแต่ละบทเขียนด้วยฟอนต์ใหญ่ แต่ไม่ได้บอกว่านี่คือ "บทที่ X" — คนตาดีเดาได้ แต่คนใช้ screen reader ไม่รู้ว่าขึ้นบทใหม่แล้ว

### Fix

```tsx
// ✅ หลังแก้ — ทั้ง 5 panels
<h2 id="field-heading" className="text-sm font-medium text-zinc-700">
  Fields
</h2>
```

เพิ่ม aria attributes เสริม:
- `aria-live="polite"` บน SaveIndicator — บอก screen reader ให้อ่านเมื่อ status เปลี่ยน
- `aria-busy={isPending}` บนปุ่ม RUN — บอกว่ากำลัง loading อยู่

### บทเรียน

HTML element ที่ "ดูเหมือน" heading ด้วย CSS ≠ heading จริงสำหรับ accessibility — ใช้ `<h1>`–`<h6>` ให้ถูกตามโครงสร้าง content

---

## สรุป Bug ทั้ง 9 ตัว

| # | Bug | หมวด | ระดับ |
|---|-----|------|-------|
| 1 | `environmentMatchGlobs` ไม่มีใน Vitest 4 | Config | HIGH |
| 2 | `expect is not defined` — jest-dom + globals:false | Config | HIGH |
| 3 | Vitest รัน E2E test โดยไม่ตั้งใจ | Config | HIGH |
| 4 | Firefox spawn UNKNOWN บน Windows | Config | MEDIUM |
| 5 | `vite-tsconfig-paths` plugin ซ้ำซ้อน | Config | LOW |
| 6 | `test-results/` ถูก commit โดยไม่ตั้งใจ | Process | MEDIUM |
| 7 | `issues[0]` ไม่มี guard | Test Logic | MEDIUM |
| 8 | Dismiss logic อยู่ผิด component | Architecture | MEDIUM |
| 9 | `<span>` แทน `<h2>` — accessibility | A11y | MEDIUM |

---

## Validation (ยืนยันว่า Fix ทำงาน)

| การทดสอบ | ผล |
|---------|-----|
| Vitest unit tests | **67/67 ผ่าน** |
| Playwright E2E — Chromium | **9/9 ผ่าน** |
| Playwright E2E — WebKit | **9/9 ผ่าน** |
| Playwright E2E — Firefox | CI-only (ไม่ทดสอบ local) |
| `npx tsc --noEmit` | **ผ่าน ไม่มี error** |
| `npm run build` | **ผ่าน production build clean** |

---

## Commits ที่เกี่ยวข้อง

| Commit | คำอธิบาย |
|--------|---------|
| `d2f2b30` | feat(09): Phase 9 complete — unit + E2E tests |
| `dfd3e0f` | pilot snapshot พร้อม review fixes ทั้งหมด |
| `13542cc` | fix(09): untrack test-results, gitignore, Firefox CI-only |

---

## Action Items

1. **เพิ่ม component tests (jsdom)** — ตอนนี้ใช้ `environment: 'node'` เท่านั้น เมื่อสร้าง component tests ให้เปิด `globals: true` หรือใช้ `environmentMatchGlobs` pattern ของ Vitest เวอร์ชัน future ที่อาจ support กลับมา (Owner: Dev, เมื่อมี component ซับซ้อน)

2. **Enable Firefox ใน local ถ้าติดตั้ง VC++ libs** — เพิ่ม note ใน README วิธีติดตั้ง VC++ Redistributable สำหรับ dev ที่ต้องการรัน Firefox local (Owner: Dev)

3. **ตรวจ `.gitignore` ทุกครั้งที่ติดตั้ง tool ใหม่** — เพิ่มใน onboarding checklist (Owner: Dev)
