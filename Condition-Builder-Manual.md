# Condition Builder — คู่มือการใช้งาน

## เริ่มต้นโปรเจกต์

```bash
# ติดตั้ง dependencies
npm install

# สร้างไฟล์ env (ถ้ายังไม่มี)
cp .env.example .env.local
# แล้วใส่ค่า DATABASE_URL และ DIRECT_URL

# รัน dev server
npm run dev
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000/builder`

---

## ภาพรวมหน้าจอ

หน้าจอแบ่งเป็น 5 ส่วนจากบนลงล่าง:

```
┌────────────────────────────────────┐
│  Condition Builder        [RUN]    │  ← Header
├────────────────────────────────────┤
│  Fields                [Add Field] │  ← 1. กำหนด Data Sources
├────────────────────────────────────┤
│  Condition                     [+] │  ← 2. เงื่อนไข
├────────────────────────────────────┤
│  Actions                       [+] │  ← 3. (placeholder)
├────────────────────────────────────┤
│  Result                        [+] │  ← 4. สูตรคำนวณ
├────────────────────────────────────┤
│  Preview (Mock Data + Output)      │  ← 5. ทดสอบผลลัพธ์
└────────────────────────────────────┘
```

---

## ส่วนที่ 1 — Fields (กำหนด Data Sources)

**เพิ่ม Table ใหม่:** กดปุ่ม `Add Field +` ที่มุมขวาบน → จะได้ card ชื่อ "Table 1"

**เพิ่ม Field เข้า Table:**
- กด `+` ที่มุมขวาบนของ card → พิมพ์ชื่อ field → กด Enter (หรือคลิกออก)
- Field ที่สร้างจะมี dataType เป็น `number` โดย default

**จัดการ Table:**
- คลิกที่ **ชื่อ Table** เพื่อเปลี่ยนชื่อ → แก้ไข → Enter
- กด `×` ที่มุมขวาบนของ card เพื่อลบ Table ทั้ง card
- กด `×` ข้างชื่อ field เพื่อลบ field เดียว (hover เพื่อให้ปุ่มปรากฏ)

**Drag Fields:** field แต่ละตัวสามารถ drag ไปวางใน Condition และ Result ได้

---

## ส่วนที่ 2 — Condition (กำหนดเงื่อนไข)

**เพิ่ม Condition:** กดปุ่ม `+` → จะได้แถวใหม่ที่มี 3 ส่วน:

```
[Left: Drop field]  [Operator ▼]  [Right: Drop field / abc]   ×
```

**กำหนด Left (ฝั่งซ้าย):** drag field จาก Fields panel มาวางที่ drop zone `Drop field`

**เลือก Operator:**

| ตัวเลือก | ความหมาย |
|---|---|
| Equal | = เท่ากัน |
| Greater Than | > มากกว่า |
| Less Than | < น้อยกว่า |
| Not Equal | ≠ ไม่เท่ากัน |
| Contains | มีข้อความนั้นอยู่ (สำหรับ string) |

**กำหนด Right (ฝั่งขวา) — 2 แบบ:**
- **Field Mode (default):** drag field มาวาง — เปรียบเทียบ field กับ field
- **Literal Mode:** กดปุ่ม `abc` ข้างๆ drop zone → พิมพ์ค่าตัวเลขหรือ string ได้เลย
  - กลับไป Field Mode: กดปุ่ม `⊞`

**ลบ Condition:** กดปุ่ม `×` ด้านขวาสุดของแถว

---

## ส่วนที่ 3 — Result (สร้าง Formula)

**เพิ่ม Result:** กดปุ่ม `+` → ได้แถวใหม่:

```
[Name input]  →  [Drop field / value]  [abc] [+op] [%]    ×
```

**ตั้งชื่อ Result:** พิมพ์ชื่อในช่องซ้ายสุด (เช่น "Bonus", "Tax Amount")

**สร้าง Expression — ปุ่มเล็กๆ ที่ Node แต่ละตัว:**

| ปุ่ม | ทำอะไร |
|---|---|
| `abc` | เปลี่ยนเป็น Literal (พิมพ์ค่าตรงๆ) |
| `⊞` | เปลี่ยนกลับเป็น Field drop zone |
| `+op` | เพิ่ม Operation — ห่อ node นี้เป็น `[node] + [Drop field]` |
| `%` | ห่อ node นี้เป็น percent (หาร 100) |
| Operator dropdown | เลือก `+` `-` `×` `÷` `mod` |
| `×` ข้าง operation | ยุบ operation — เหลือแค่ left operand |

**ตัวอย่าง: สร้าง `Table1.Salary × 0.1`**
1. Drag field `Salary` มาวางที่ drop zone → ได้ `[Table1.Salary]`
2. กด `+op` → ได้ `[Table1.Salary] + [Drop field]`
3. เปลี่ยน `+` เป็น `×` ใน dropdown
4. กดปุ่ม `abc` ที่ node ขวา → พิมพ์ `0.1`

---

## ส่วนที่ 4 — Preview (ทดสอบผลลัพธ์)

### Mock Data

ด้านบนของ Preview จะแสดง input สำหรับแต่ละ field — ใส่ค่าที่ต้องการทดสอบได้เลย (ค่า default เป็น `1` สำหรับ number)

### กด RUN

กดปุ่ม **RUN** ที่ header → ระบบส่ง state ทั้งหมดไปคำนวณ server-side แล้วแสดงผล:

- **Conditions:** แต่ละเงื่อนไขจะแสดง ✅ (pass) หรือ ❌ (fail) พร้อมค่าที่เปรียบเทียบ
- **Results:** แต่ละ formula แสดงชื่อ `=` ค่าที่คำนวณได้

### Auto-Save

ทุกการเปลี่ยนแปลงจะ save อัตโนมัติ (debounce 500ms) — สังเกตสถานะ "Saving..." / "Saved" ที่ header

---

## Demo Scenario — ระบบคำนวณโบนัส

สถานการณ์: ถ้า `ยอดขาย > เป้าหมาย` ให้คำนวณ `โบนัส = ยอดขาย × 10%`

### Step 1: สร้าง Fields

- กด `Add Field +` → ได้ "Table 1" → คลิกชื่อเปลี่ยนเป็น "Employee"
- กด `+` เพิ่ม field → พิมพ์ `Sales` → Enter
- กด `+` อีกครั้ง → พิมพ์ `Target` → Enter

### Step 2: สร้าง Condition

- กด `+` ใน Condition panel
- Drag `Employee.Sales` มาวางที่ Left
- Operator เลือก "Greater Than"
- Drag `Employee.Target` มาวางที่ Right

### Step 3: สร้าง Result

- กด `+` ใน Result panel → ตั้งชื่อเป็น "Bonus"
- Drag `Employee.Sales` มาวางที่ expression
- กด `+op` → เปลี่ยน operator เป็น `×`
- กดปุ่ม `abc` ที่ node ขวา → พิมพ์ `0.1`

### Step 4: ทดสอบ

- ไปที่ Preview → ใส่ `Sales = 150000`, `Target = 100000`
- กด **RUN**
- Condition แสดง ✅ `150000 > 100000`
- Result แสดง `Bonus = 15000`

---

## Demo Scenario — ระบบคำนวณภาษี

สถานการณ์: ถ้า `รายได้ >= 300000` ให้คำนวณ `ภาษี = (รายได้ - ค่าลดหย่อน) × 15%`

### Step 1: สร้าง Fields

- เพิ่ม Table ชื่อ "Income"
- เพิ่ม field `Revenue` และ `Deduction`

### Step 2: สร้าง Condition

- Left: Drag `Income.Revenue`
- Operator: "Greater Than"
- Right: กดปุ่ม `abc` → พิมพ์ `300000`

### Step 3: สร้าง Result

- ตั้งชื่อ "Tax"
- Drag `Income.Revenue` มาวาง → กด `+op` → เปลี่ยนเป็น `-`
- Drag `Income.Deduction` มาวาง (node ขวา)
- กด `%` ที่ root → ได้ `(Revenue - Deduction)(%)`
- กด `+op` → เปลี่ยนเป็น `×` → กด `abc` ที่ node ขวา → พิมพ์ `15`

### Step 4: ทดสอบ

- ใส่ `Revenue = 500000`, `Deduction = 100000`
- กด **RUN** → `Tax = 60000`

---

---

## Demo Scenarios — 10 Industries

---

### Scenario 1: Finance — อนุมัติสินเชื่อ (Loan Approval)

**โจทย์:** ถ้า `Credit Score >= 700` และ `หนี้สิน < รายได้ × 40%` → คำนวณ `วงเงินกู้สูงสุด = รายได้ × 5`

**Fields (Table: Applicant)**
- `CreditScore` — คะแนนเครดิต
- `MonthlyIncome` — รายได้ต่อเดือน
- `TotalDebt` — หนี้สินรวม

**Condition 1 — Credit Score ผ่านเกณฑ์**
- Left: `Applicant.CreditScore` | Operator: `Greater Than` | Right: `abc` → `699`

**Condition 2 — หนี้ไม่เกิน 40% ของรายได้**
- Left: `Applicant.TotalDebt` | Operator: `Less Than` | Right: `abc` → พิมพ์สัดส่วน (ใช้ mock data ปรับค่าแทน)

**Result: MaxLoan**
- Drag `Applicant.MonthlyIncome` → กด `+op` → เปลี่ยนเป็น `×` → `abc` → พิมพ์ `5`

**ทดสอบ:** `CreditScore = 720`, `MonthlyIncome = 50000`, `TotalDebt = 15000`
- Condition 1 ✅ `720 > 699`
- Condition 2 ✅ `15000 < 20000`
- MaxLoan = `250000`

---

### Scenario 2: HR — คำนวณ OT (Overtime Pay)

**โจทย์:** ถ้า `ชั่วโมงทำงาน > 8` → `OT Pay = (ชั่วโมง - 8) × อัตรา OT`

**Fields (Table: Employee)**
- `HoursWorked` — ชั่วโมงทำงานจริง
- `OTRate` — อัตราค่า OT ต่อชั่วโมง

**Condition**
- Left: `Employee.HoursWorked` | Operator: `Greater Than` | Right: `abc` → `8`

**Result: OTPay**
- Drag `Employee.HoursWorked` → กด `+op` → เปลี่ยนเป็น `-` → `abc` → `8`
- กด `+op` ที่ root → เปลี่ยนเป็น `×` → Drag `Employee.OTRate`

**ทดสอบ:** `HoursWorked = 11`, `OTRate = 150`
- Condition ✅ `11 > 8`
- OTPay = `450` (3 ชั่วโมง × 150)

---

### Scenario 3: Retail — ส่วนลดสินค้า (Dynamic Discount)

**โจทย์:** ถ้า `ยอดซื้อ >= 1000` → `ส่วนลด = ยอดซื้อ × 15%`, `ราคาสุทธิ = ยอดซื้อ - ส่วนลด`

**Fields (Table: Order)**
- `SubTotal` — ยอดก่อนส่วนลด

**Condition**
- Left: `Order.SubTotal` | Operator: `Greater Than` | Right: `abc` → `999`

**Result 1: Discount**
- Drag `Order.SubTotal` → กด `%` → กด `+op` → `×` → `abc` → `15`

**Result 2: NetPrice**
- Drag `Order.SubTotal` → กด `+op` → เปลี่ยนเป็น `-` → Drag `Order.SubTotal`
  - (ใช้ค่า Discount จาก Result 1 เป็น reference ใน mock — ป้อน Discount ด้วยตนเองใน Preview)

**ทดสอบ:** `SubTotal = 2000`
- Condition ✅ `2000 > 999`
- Discount = `300` (2000 × 15%)
- NetPrice = `1700`

---

### Scenario 4: Insurance — คำนวณเบี้ยประกัน (Premium Calculation)

**โจทย์:** ถ้า `อายุ > 40` → `เบี้ยประกัน = ทุนประกัน × 3%`, ถ้าอายุ ≤ 40 → `× 1.5%`

**Fields (Table: Insured)**
- `Age` — อายุผู้เอาประกัน
- `CoverageAmount` — ทุนประกัน

**Condition — กลุ่มความเสี่ยงสูง**
- Left: `Insured.Age` | Operator: `Greater Than` | Right: `abc` → `40`

**Result 1: PremiumHigh (สำหรับกลุ่มอายุ > 40)**
- Drag `Insured.CoverageAmount` → กด `%` → กด `+op` → `×` → `abc` → `3`

**Result 2: PremiumLow (สำหรับกลุ่มอายุ ≤ 40)**
- Drag `Insured.CoverageAmount` → กด `%` → กด `+op` → `×` → `abc` → `1.5`

**ทดสอบ:** `Age = 45`, `CoverageAmount = 1000000`
- Condition ✅ `45 > 40` → ใช้ PremiumHigh
- PremiumHigh = `30000`
- PremiumLow = `15000` (กรณีอายุน้อยกว่า)

---

### Scenario 5: Manufacturing — ตรวจสอบคุณภาพ (Quality Control)

**โจทย์:** ถ้า `ค่าเบี่ยงเบน <= ค่าเผื่อ` → ผ่าน QC, คำนวณ `% ของเสีย = (จำนวนเสีย / ผลิตทั้งหมด) × 100`

**Fields (Table: Production)**
- `Deviation` — ค่าเบี่ยงเบนจากมาตรฐาน
- `Tolerance` — ค่าเผื่อที่ยอมรับได้
- `DefectCount` — จำนวนชิ้นเสีย
- `TotalProduced` — จำนวนผลิตทั้งหมด

**Condition — ผ่านเกณฑ์ QC**
- Left: `Production.Deviation` | Operator: `Less Than` | Right: Drag `Production.Tolerance`

**Result: DefectRate**
- Drag `Production.DefectCount` → กด `+op` → เปลี่ยนเป็น `÷` → Drag `Production.TotalProduced`
- กด `+op` ที่ root → `×` → `abc` → `100`

**ทดสอบ:** `Deviation = 0.3`, `Tolerance = 0.5`, `DefectCount = 12`, `TotalProduced = 500`
- Condition ✅ `0.3 < 0.5`
- DefectRate = `2.4` (%)

---

### Scenario 6: Logistics — คำนวณค่าขนส่ง (Shipping Fee)

**โจทย์:** ถ้า `น้ำหนัก > 10 kg` → `ค่าขนส่ง = น้ำหนัก × 35`, ไม่เกิน 10 kg → `น้ำหนัก × 50` (ขั้นต่ำ)

**Fields (Table: Shipment)**
- `WeightKg` — น้ำหนักพัสดุ (kg)
- `DistanceKm` — ระยะทาง (km)

**Condition — น้ำหนักเกิน tier**
- Left: `Shipment.WeightKg` | Operator: `Greater Than` | Right: `abc` → `10`

**Result 1: FeeHeavy (> 10 kg)**
- Drag `Shipment.WeightKg` → `+op` → `×` → `abc` → `35`

**Result 2: FeeLight (≤ 10 kg)**
- Drag `Shipment.WeightKg` → `+op` → `×` → `abc` → `50`

**Result 3: DistanceSurcharge**
- Drag `Shipment.DistanceKm` → `+op` → `×` → `abc` → `2`

**ทดสอบ:** `WeightKg = 15`, `DistanceKm = 80`
- Condition ✅ `15 > 10` → ใช้ FeeHeavy
- FeeHeavy = `525`
- DistanceSurcharge = `160`

---

### Scenario 7: Healthcare — คำนวณ BMI และประเมินความเสี่ยง

**โจทย์:** คำนวณ `BMI = น้ำหนัก ÷ (ส่วนสูง × ส่วนสูง)`, ถ้า `BMI > 25` → เข้าข่ายน้ำหนักเกิน

**Fields (Table: Patient)**
- `WeightKg` — น้ำหนัก (kg)
- `HeightM` — ส่วนสูง (เมตร เช่น 1.70)

**Condition — น้ำหนักเกิน**
- ใช้ BMI จาก Result มาเทียบ: Left ใส่ค่า BMI ใน mock data | Operator: `Greater Than` | Right: `abc` → `25`

**Result: BMI**
- Drag `Patient.HeightM` → กด `+op` → `×` → Drag `Patient.HeightM` (ส่วนสูง²)
- กด `+op` ที่ root → เปลี่ยนเป็น `÷` แต่ต้องวางไว้ก่อน แล้ว swap ด้วยการ wrap:
  - สร้าง Result แยก: ตั้งชื่อ "HeightSq" = `HeightM × HeightM`
  - สร้าง Result ชื่อ "BMI": Drag `Patient.WeightKg` → `+op` → `÷` → `abc` แล้วใส่ค่า HeightSq จาก mock

**ทดสอบ:** `WeightKg = 75`, `HeightM = 1.70`
- HeightSq = `2.89`
- BMI = `25.95` → Condition ✅ เข้าข่ายน้ำหนักเกิน

---

### Scenario 8: Real Estate — คำนวณค่าคอมมิชชัน (Agent Commission)

**โจทย์:** ถ้า `ราคาขาย >= 5,000,000` → `คอมมิชชัน = ราคาขาย × 3%`, ต่ำกว่านั้น → `× 2%`

**Fields (Table: Property)**
- `SalePrice` — ราคาขายจริง
- `ListingPrice` — ราคาตั้ง

**Condition — ระดับราคาสูง**
- Left: `Property.SalePrice` | Operator: `Greater Than` | Right: `abc` → `4999999`

**Result 1: CommissionHigh**
- Drag `Property.SalePrice` → `%` → `+op` → `×` → `abc` → `3`

**Result 2: CommissionStd**
- Drag `Property.SalePrice` → `%` → `+op` → `×` → `abc` → `2`

**Result 3: PriceDrop**
- Drag `Property.ListingPrice` → `+op` → `-` → Drag `Property.SalePrice`

**ทดสอบ:** `SalePrice = 7500000`, `ListingPrice = 8000000`
- Condition ✅ `7500000 > 4999999`
- CommissionHigh = `225000`
- PriceDrop = `500000`

---

### Scenario 9: Education — คำนวณเกรด GPA

**โจทย์:** ถ้า `คะแนนเฉลี่ย >= 80` → ผ่านเกณฑ์เกียรตินิยม, คำนวณ `คะแนนรวม = (Midterm × 40%) + (Final × 60%)`

**Fields (Table: Student)**
- `Midterm` — คะแนนสอบกลางภาค
- `Final` — คะแนนสอบปลายภาค

**Condition — เกียรตินิยม**
- Left: `Student.Midterm` | Operator: `Greater Than` | Right: `abc` → `79`
  (ใช้เพื่อ demo — ในระบบจริงจะใช้ TotalScore เป็น Left)

**Result 1: MidtermWeighted**
- Drag `Student.Midterm` → `%` → `+op` → `×` → `abc` → `40`

**Result 2: FinalWeighted**
- Drag `Student.Final` → `%` → `+op` → `×` → `abc` → `60`

**Result 3: TotalScore**
- `abc` → พิมพ์ค่า MidtermWeighted จาก mock → `+op` → `+` → `abc` → ค่า FinalWeighted

**ทดสอบ:** `Midterm = 85`, `Final = 90`
- MidtermWeighted = `34`
- FinalWeighted = `54`
- TotalScore = `88`

---

### Scenario 10: E-commerce — คะแนนสะสมและ Tier

**โจทย์:** ถ้า `ยอดซื้อสะสม >= 10,000` → `สถานะ Gold`, คำนวณ `คะแนนได้รับ = ยอดซื้อครั้งนี้ ÷ 25`

**Fields (Table: Member)**
- `TotalSpent` — ยอดซื้อสะสม
- `OrderAmount` — ยอดซื้อครั้งนี้
- `CurrentPoints` — คะแนนสะสมปัจจุบัน

**Condition — ระดับ Gold**
- Left: `Member.TotalSpent` | Operator: `Greater Than` | Right: `abc` → `9999`

**Result 1: PointsEarned**
- Drag `Member.OrderAmount` → `+op` → `÷` → `abc` → `25`

**Result 2: NewTotalPoints**
- Drag `Member.CurrentPoints` → `+op` → `+` → Drag `Member.OrderAmount`
  - (แทนด้วย PointsEarned ใน mock)

**Result 3: NewTotalSpent**
- Drag `Member.TotalSpent` → `+op` → `+` → Drag `Member.OrderAmount`

**ทดสอบ:** `TotalSpent = 12000`, `OrderAmount = 850`, `CurrentPoints = 450`
- Condition ✅ `12000 > 9999` → สมาชิกระดับ Gold
- PointsEarned = `34`
- NewTotalSpent = `12850`

---

## ข้อจำกัดปัจจุบัน (สำหรับ POC)

| ส่วน | สถานะ |
|---|---|
| Fields — เพิ่ม/ลบ/เปลี่ยนชื่อ | ✅ ใช้งานได้ |
| Conditions — all operators | ✅ ใช้งานได้ |
| Result — formula tree (max depth 8) | ✅ ใช้งานได้ |
| Auto-save to DB | ✅ ใช้งานได้ |
| Actions panel | ⬜ placeholder ยังไม่ implement |
| Field dataType selector (UI) | ⬜ ทุก field เป็น number — ยังไม่มี type picker |
| AND/OR logic ระหว่าง Conditions | ⬜ แต่ละ condition อิสระจากกัน |
| Load builder state เดิมจาก DB | ⬜ ขึ้นกับ Prisma schema มี model หรือยัง |

---

---

## Demo Scenarios — Multi-Table (ข้ามตาราง)

สถานการณ์เหล่านี้แสดงจุดแข็งหลักของ Condition Builder — การ drag field จาก **คนละ Table** มาเปรียบเทียบหรือคำนวณร่วมกัน

---

### Multi-Table 1: Finance — เปรียบเทียบราคาหุ้น vs ราคาทุน (Portfolio PnL)

**โจทย์:** ถ้า `ราคาตลาด > ราคาทุน` → กำไร, คำนวณ `กำไร/ขาดทุน = (ราคาตลาด - ราคาทุน) × จำนวนหุ้น`

**Fields**

Table: **Market**
- `Price` — ราคาตลาดปัจจุบัน

Table: **Portfolio**
- `CostPrice` — ราคาทุนที่ซื้อมา
- `Shares` — จำนวนหุ้นที่ถือ

**Condition — อยู่ในกำไร**
- Left: Drag `Market.Price` | Operator: `Greater Than` | Right: Drag `Portfolio.CostPrice`

**Result 1: PnLPerShare**
- Drag `Market.Price` → `+op` → เปลี่ยนเป็น `-` → Drag `Portfolio.CostPrice`

**Result 2: TotalPnL**
- Drag `Market.Price` → `+op` → `-` → Drag `Portfolio.CostPrice`
  - กด `+op` ที่ root → `×` → Drag `Portfolio.Shares`

**ทดสอบ:** `Market.Price = 285`, `Portfolio.CostPrice = 210`, `Portfolio.Shares = 500`
- Condition ✅ `285 > 210`
- PnLPerShare = `75`
- TotalPnL = `37500`

---

### Multi-Table 2: HR — เทียบเงินเดือนจริงกับ Grade Structure

**โจทย์:** ถ้า `เงินเดือนจริง < เงินเดือนขั้นต่ำของ Grade` → ต้องปรับ, คำนวณ `ส่วนต่างที่ต้องปรับ`

**Fields**

Table: **Employee**
- `ActualSalary` — เงินเดือนที่รับอยู่
- `YearsOfService` — อายุงาน (ปี)

Table: **GradeScale**
- `MinSalary` — เงินเดือนขั้นต่ำของ Grade
- `MaxSalary` — เงินเดือนสูงสุดของ Grade

**Condition 1 — เงินเดือนต่ำกว่า min**
- Left: Drag `Employee.ActualSalary` | Operator: `Less Than` | Right: Drag `GradeScale.MinSalary`

**Condition 2 — เงินเดือนไม่เกิน max**
- Left: Drag `Employee.ActualSalary` | Operator: `Less Than` | Right: Drag `GradeScale.MaxSalary`

**Result 1: SalaryGap**
- Drag `GradeScale.MinSalary` → `+op` → `-` → Drag `Employee.ActualSalary`

**Result 2: AdjustedSalary**
- Drag `GradeScale.MinSalary`

**Result 3: LoyaltyBonus**
- Drag `Employee.YearsOfService` → `+op` → `×` → `abc` → `500`

**ทดสอบ:** `ActualSalary = 28000`, `YearsOfService = 5`, `MinSalary = 32000`, `MaxSalary = 55000`
- Condition 1 ✅ `28000 < 32000` → ต้องปรับเงินเดือน
- SalaryGap = `4000`
- AdjustedSalary = `32000`
- LoyaltyBonus = `2500`

---

### Multi-Table 3: Retail — เช็คสต็อกก่อนขาย (Inventory Check)

**โจทย์:** ถ้า `ยอดสั่งซื้อ <= สต็อกคงเหลือ` → ขายได้, คำนวณ `มูลค่าขาย = ยอดสั่ง × ราคาขาย` และ `กำไรขั้นต้น`

**Fields**

Table: **Order**
- `QtyOrdered` — จำนวนที่ลูกค้าสั่ง
- `UnitPrice` — ราคาขายต่อหน่วย

Table: **Inventory**
- `StockQty` — สต็อกคงเหลือ
- `CostPrice` — ราคาทุนต่อหน่วย

**Condition — สต็อกพอ**
- Left: Drag `Order.QtyOrdered` | Operator: `Less Than` | Right: Drag `Inventory.StockQty`

**Result 1: SaleAmount**
- Drag `Order.QtyOrdered` → `+op` → `×` → Drag `Order.UnitPrice`

**Result 2: COGS** (Cost of Goods Sold)
- Drag `Order.QtyOrdered` → `+op` → `×` → Drag `Inventory.CostPrice`

**Result 3: GrossProfit**
- Drag `Order.QtyOrdered` → `+op` → `×` → Drag `Order.UnitPrice`
  - กด `+op` ที่ root → `-` → Drag `Order.QtyOrdered` → `+op` → `×` → Drag `Inventory.CostPrice`

**Result 4: RemainingStock**
- Drag `Inventory.StockQty` → `+op` → `-` → Drag `Order.QtyOrdered`

**ทดสอบ:** `QtyOrdered = 30`, `UnitPrice = 450`, `StockQty = 80`, `CostPrice = 280`
- Condition ✅ `30 < 80`
- SaleAmount = `13500`
- COGS = `8400`
- GrossProfit = `5100`
- RemainingStock = `50`

---

### Multi-Table 4: Logistics — เทียบน้ำหนักจริงกับน้ำหนักปริมาตร (Chargeable Weight)

**โจทย์:** ค่าขนส่งคิดตาม `น้ำหนักที่สูงกว่า` ระหว่างน้ำหนักจริงกับน้ำหนักปริมาตร

**Fields**

Table: **Parcel**
- `ActualWeight` — น้ำหนักจริง (kg)
- `Length` — กว้าง (cm)
- `Width` — ยาว (cm)
- `Height` — สูง (cm)

Table: **Rate**
- `PricePerKg` — ราคาต่อ kg
- `VolumeDivisor` — ตัวหาร volumetric (ปกติ 5000)

**Result 1: VolumetricWeight**
- Drag `Parcel.Length` → `+op` → `×` → Drag `Parcel.Width`
  - กด `+op` → `×` → Drag `Parcel.Height`
  - กด `+op` → `÷` → Drag `Rate.VolumeDivisor`

**Result 2: ShippingFeeActual**
- Drag `Parcel.ActualWeight` → `+op` → `×` → Drag `Rate.PricePerKg`

**Result 3: ShippingFeeVolumetric**
- ใส่ค่า VolumetricWeight จาก mock → `+op` → `×` → Drag `Rate.PricePerKg`

**Condition — น้ำหนักปริมาตรสูงกว่าน้ำหนักจริง**
- Left: ใส่ค่า VolumetricWeight จาก mock | Operator: `Greater Than` | Right: Drag `Parcel.ActualWeight`

**ทดสอบ:** `Length = 60`, `Width = 40`, `Height = 30`, `ActualWeight = 8`, `PricePerKg = 35`, `VolumeDivisor = 5000`
- VolumetricWeight = `14.4`
- Condition ✅ `14.4 > 8` → คิดตาม Volumetric
- ShippingFeeActual = `280`
- ShippingFeeVolumetric = `504` ← ใช้ตัวนี้

---

### Multi-Table 5: Manufacturing — เปรียบเทียบ Actual vs Standard Cost

**โจทย์:** ถ้า `ต้นทุนจริง > ต้นทุนมาตรฐาน` → เกิด Cost Overrun, คำนวณ `Variance` และ `% เบี่ยงเบน`

**Fields**

Table: **Actual**
- `MaterialCost` — ต้นทุนวัตถุดิบจริง
- `LaborCost` — ต้นทุนแรงงานจริง
- `OverheadCost` — ต้นทุน Overhead จริง

Table: **Standard**
- `StdMaterial` — ต้นทุนวัตถุดิบมาตรฐาน
- `StdLabor` — ต้นทุนแรงงานมาตรฐาน
- `StdOverhead` — ต้นทุน Overhead มาตรฐาน

**Result 1: ActualTotal**
- Drag `Actual.MaterialCost` → `+op` → `+` → Drag `Actual.LaborCost`
  - กด `+op` → `+` → Drag `Actual.OverheadCost`

**Result 2: StandardTotal**
- Drag `Standard.StdMaterial` → `+op` → `+` → Drag `Standard.StdLabor`
  - กด `+op` → `+` → Drag `Standard.StdOverhead`

**Result 3: Variance**
- ใส่ค่า ActualTotal จาก mock → `+op` → `-` → ใส่ค่า StandardTotal จาก mock

**Result 4: VariancePct**
- ใส่ค่า Variance จาก mock → `+op` → `÷` → ใส่ค่า StandardTotal จาก mock
  - กด `+op` → `×` → `abc` → `100`

**Condition — Cost Overrun**
- Left: ใส่ค่า ActualTotal จาก mock | Operator: `Greater Than` | Right: ใส่ค่า StandardTotal จาก mock

**ทดสอบ:**
- `MaterialCost = 45000`, `LaborCost = 28000`, `OverheadCost = 12000`
- `StdMaterial = 40000`, `StdLabor = 25000`, `StdOverhead = 10000`
- ActualTotal = `85000`
- StandardTotal = `75000`
- Condition ✅ `85000 > 75000` → มี Cost Overrun
- Variance = `10000`
- VariancePct = `13.33` (%)

---

## คำสั่ง Quick Reference

```bash
npm run dev           # เปิด dev server
npm run test          # รัน unit tests
npm run build         # build production
npx tsc --noEmit      # ตรวจ TypeScript errors
npm run db:studio     # เปิด Prisma Studio ดู DB
npx prisma migrate dev   # สร้าง + apply migration ใหม่
vercel env pull .env.local  # ดึง env จาก Vercel
```
