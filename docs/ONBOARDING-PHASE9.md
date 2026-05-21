# Onboarding Guide — Phase 9: Polish + Testing

> สำหรับ Developer มือใหม่ที่เพิ่งเข้าร่วม project หรือกำลังจะ maintain / extend test suite
> เขียนแบบภาษาชาวบ้าน อ่านแล้วเข้าใจได้โดยไม่ต้องมีพื้นฐาน advanced

---

## Phase 9 ทำอะไร? (ภาพรวม 2 นาที)

ก่อน Phase 9 — แอปทำงานได้แต่ถ้าแก้โค้ดแล้วพังจะรู้ตอนเปิด browser ดูด้วยตาเท่านั้น

Phase 9 เพิ่ม **ตาข่ายนิรภัย** 3 ชั้น:

```
ชั้น 1: Unit Tests (Vitest)
        → ทดสอบฟังก์ชันเล็กๆ แยกชิ้น ไม่ต้องเปิด browser
        → เร็ว: รัน 67 tests ใน < 2 วินาที

ชั้น 2: E2E Tests (Playwright)
        → เปิด browser จริง คลิกปุ่มจริง URL จริง
        → ช้ากว่า: รัน 9 tests ใน ~ 30 วินาที

ชั้น 3: Production Build
        → TypeScript compile + bundle ไม่มี error
        → รัน: npm run build
```

---

## ไฟล์ที่เพิ่มใน Phase 9

| ไฟล์ | หน้าที่ |
|------|--------|
| `vitest.config.ts` | ตั้งค่า Vitest — test patterns, environment, coverage |
| `playwright.config.ts` | ตั้งค่า Playwright — browsers, dev server, timeout |
| `src/test/setup.ts` | รันก่อนทุก test — global setup |
| `src/lib/formula-engine.test.ts` | 19 unit tests สำหรับ formula engine |
| `src/lib/condition-evaluator.test.ts` | 14 unit tests สำหรับ condition evaluator |
| `src/lib/schema.test.ts` | 34 unit tests สำหรับ Zod schemas |
| `e2e/builder.spec.ts` | 9 E2E tests สำหรับ user flows |

---

## รัน Tests ยังไง?

```bash
# Unit tests ทั้งหมด (เร็ว — รัน local บ่อยๆ ได้)
npm run test

# Unit tests พร้อมดู coverage
npm run test:coverage

# รัน test ไฟล์เดียว
npx vitest run src/lib/formula-engine.test.ts

# E2E tests (ต้องมี dev server รันอยู่ หรือให้ Playwright start เอง)
npm run test:e2e

# E2E แบบ headed (เปิด browser ให้ดู)
npx playwright test --headed

# Production build
npm run build
```

---

## ทำความเข้าใจ vitest.config.ts

```typescript
export default defineConfig({
  plugins: [react()],           // ← ต้องมีสำหรับ JSX
  resolve: {
    tsconfigPaths: true,        // ← ทำให้ @/lib/... ทำงานได้ใน tests
  },
  test: {
    environment: 'node',        // ← tests รันบน Node.js ไม่ใช่ browser
    include: ['src/**/*.test.{ts,tsx}'],   // ← รันเฉพาะใน src/
    exclude: ['e2e/**'],        // ← ห้ามแตะ Playwright files
    globals: false,             // ← ต้อง import { expect } from 'vitest' เอง
    coverage: {
      thresholds: { lines: 80, functions: 80, branches: 80 }  // ← ต่ำกว่านี้ CI fail
    },
  },
})
```

### จุดที่คนมักสับสน

**Q: ทำไมต้อง `globals: false`?**
A: บังคับให้ import ชัดเจน `import { describe, it, expect } from 'vitest'` ทุกไฟล์
   แทนที่จะมี `expect` ลอยๆ ใน global อ่านโค้ดแล้วรู้ทันทีว่า expect มาจากไหน

**Q: ทำไม `environment: 'node'` ไม่ใช่ `jsdom`?**
A: tests ปัจจุบันทดสอบ pure functions (`formula-engine`, `condition-evaluator`, `schema`)
   ไม่มีอะไรที่ต้องการ browser API เช่น `document`, `window`
   `node` environment เร็วกว่า jsdom มาก
   เมื่อมี component tests ให้เปลี่ยน environment ตาม need

**Q: `tsconfigPaths: true` คืออะไร?**
A: ทำให้ `import '@/lib/schema'` ทำงานได้ใน Vitest
   โดยไม่ต้องติดตั้ง plugin `vite-tsconfig-paths` เพราะ Vite 6 มี built-in แล้ว

---

## โครงสร้าง Unit Test — Pattern ที่ต้องรู้

### 1. AAA Pattern (Arrange-Act-Assert)

```typescript
it('adds two numbers', () => {
  // Arrange — เตรียมข้อมูล
  const node = { type: 'operation', op: '+', left: num(3), right: num(4) }

  // Act — เรียกฟังก์ชัน
  const result = evaluateFormula(node, ctx)

  // Assert — ตรวจผลลัพธ์
  expect(result).toBe(7)
})
```

### 2. Error Path Testing

```typescript
it('throws on division by zero', () => {
  // ห่อ function call ด้วย arrow function เมื่อ test ว่า throw
  expect(() => evaluateFormula(divByZeroNode, ctx)).toThrow('Division by zero')
})
```

### 3. Array Guard ก่อน Access Index

```typescript
// ❌ อันตราย — crash ถ้า issues ว่าง
expect(result.error.issues[0].message).toContain('...')

// ✅ ปลอดภัย — assert ความยาวก่อน
if (!result.success) {
  expect(result.error.issues).toHaveLength(1)
  expect(result.error.issues[0].message).toContain('...')
}
```

### 4. Helper Functions ลด Boilerplate

```typescript
// Helper ใน test file — ไม่ต้อง export ออก
function cond(left, operator, right): Condition {
  return { id: 'c1', left, operator, right }
}

const fieldRef = (tableId, fieldId) => ({ tableId, fieldId, label: `${tableId}.${fieldId}` })

// ใช้ใน test ให้อ่านง่าย
expect(evaluateCondition(cond(fieldRef('t1', 'score'), 'equal', 90), ctx)).toBe(true)
```

---

## ทำความเข้าใจ playwright.config.ts

```typescript
export default defineConfig({
  testDir: './e2e',          // ← E2E tests อยู่ที่นี่
  fullyParallel: false,      // ← รันทีละ test (DnD sensitive ต้องการ order)
  workers: 1,                // ← 1 browser instance เท่านั้น
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',  // ← save screenshot เมื่อ fail
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', ... },
    ...(process.env.CI ? [firefox] : []),  // ← Firefox เฉพาะ CI
    { name: 'webkit', ... },
  ],
  webServer: {
    command: 'npm run dev',
    reuseExistingServer: !process.env.CI,  // ← Local: ใช้ server ที่รันอยู่แล้ว
  },
})
```

### จุดที่คนมักสับสน

**Q: ทำไม Firefox ถึงเป็น CI-only?**
A: headless Firefox ต้องการ Microsoft Visual C++ Runtime ระดับ OS
   Windows local ส่วนใหญ่ไม่มี → `spawn UNKNOWN` error ทันที
   CI server (Linux) มีพร้อม → รันได้ปกติ

**Q: ทำไม `reuseExistingServer: true` ใน local?**
A: ถ้า `npm run dev` รันอยู่แล้ว Playwright จะใช้ต่อเลย ไม่ต้อง start ใหม่
   ประหยัดเวลา 10-15 วินาทีทุกครั้งที่รัน E2E

**Q: screenshot ถูกเก็บที่ไหน?**
A: `test-results/` directory (อยู่ใน .gitignore แล้ว ไม่ถูก commit)

---

## โครงสร้าง E2E Test — Pattern ที่ต้องรู้

### 1. เลือก Element ด้วย role ไม่ใช่ CSS selector

```typescript
// ✅ ดี — stable ไม่ขึ้นกับ CSS class
page.getByRole('button', { name: 'RUN' })
page.getByRole('region', { name: 'Preview' })
page.getByLabel('Literal value')

// ❌ หลีกเลี่ยง — brittle ถ้า refactor CSS
page.locator('.btn-run')
page.locator('#preview-section')
```

### 2. Scoped Assertions ป้องกัน False Positive

```typescript
// ❌ อันตราย — อาจ match '42' จาก input field อื่นในหน้า
await expect(page.getByText('42')).toBeVisible()

// ✅ ปลอดภัย — หาใน Preview region เท่านั้น
const previewRegion = page.getByRole('region', { name: 'Preview' })
await expect(previewRegion.getByText('42')).toBeVisible()
```

### 3. Deterministic Waits ไม่ใช่ Sleep

```typescript
// ❌ Flaky — บางครั้งช้ากว่า 2 วินาที
await page.waitForTimeout(2000)
await expect(page.getByText('42')).toBeVisible()

// ✅ Deterministic — รอจนกว่า element จะปรากฏ ไม่ว่าจะนานแค่ไหน
await expect(page.getByText('42')).toBeVisible()  // Playwright รอ auto
```

### 4. beforeEach สร้าง Fresh State

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/builder')  // ← navigate ใหม่ทุก test
})
```

ทำไม? เพราะ test แต่ละตัวต้อง isolated ไม่รับ state จาก test ก่อนหน้า
ถ้าไม่ทำ tests จะ order-dependent — พังเมื่อรัน out of order

---

## Coverage Report

รัน `npm run test:coverage` แล้วดูผลที่ terminal หรือ `coverage/` directory

```
ชื่อ file                   % Stmts  % Branch  % Funcs  % Lines
formula-engine.ts               94       88        95       94
condition-evaluator.ts          96       90        96       96
schema.ts                       82       78        84       82
```

**Coverage threshold: 80% ทุก metric**
ถ้าต่ำกว่า → `npm run test` จะ fail แม้ test ทุกตัวผ่าน

---

## เพิ่ม Test ใหม่ยังไง?

### Unit Test ใหม่ใน formula-engine

```typescript
// เพิ่มใน src/lib/formula-engine.test.ts
describe('evaluateFormula — ชื่อกลุ่ม', () => {
  it('ชื่อ test ที่อธิบายพฤติกรรม', () => {
    // Arrange
    const node: FormulaNode = { ... }

    // Act + Assert
    expect(evaluateFormula(node, ctx)).toBe(expectedValue)
  })
})
```

### E2E Test ใหม่

```typescript
// เพิ่มใน e2e/builder.spec.ts ภายใน describe block
test('ชื่อ test ที่อธิบาย user action', async ({ page }) => {
  // ใช้ role-based selectors
  await page.getByRole('button', { name: '...' }).click()
  await expect(page.getByRole('...', { name: '...' })).toBeVisible()
})
```

### เช็คก่อน commit

```bash
npm run test          # unit tests ผ่าน?
npm run test:e2e      # E2E ผ่าน?
npx tsc --noEmit      # TypeScript clean?
npm run build         # build ผ่าน?
```

---

## Where to Look

| ฉันอยากรู้เรื่อง... | ไปดูที่... |
|---------------------|-----------|
| ตั้งค่า Vitest | `vitest.config.ts` |
| ตั้งค่า Playwright | `playwright.config.ts` |
| Unit tests formula | `src/lib/formula-engine.test.ts` |
| Unit tests condition | `src/lib/condition-evaluator.test.ts` |
| Unit tests schema | `src/lib/schema.test.ts` |
| E2E user flows | `e2e/builder.spec.ts` |
| Global test setup | `src/test/setup.ts` |
| Bug history | `docs/post-mortem-phase-9.md` |
| Code tour แบบ interactive | `.tours/new-joiner-phase9-testing.tour` |

---

## สิ่งที่ Phase 9 ยังไม่ทำ (Action Items)

1. **Component tests (jsdom)** — ตอนนี้มีแต่ pure function tests ยังไม่มี React component tests
   → เมื่อเพิ่ม: เปลี่ยน `environment` + เปิด `@testing-library/jest-dom` ใน `setup.ts`

2. **Mobile responsive test** — test ที่ 768px มีแล้ว แต่ 375px (mobile) ยังไม่มี

3. **Firefox local** — ถ้า dev ต้องการรัน Firefox local ให้ติดตั้ง [VC++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
   แล้วลบ condition `process.env.CI ? [firefox] : []` ออกจาก `playwright.config.ts`

4. **Performance tests** — bundle size check และ Lighthouse ยังไม่มี
