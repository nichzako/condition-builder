import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config as loadEnv } from 'dotenv'
import type { BuilderState } from '../src/types'

// CLI ไม่โหลด .env.local อัตโนมัติ
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

const pool = new Pool({ connectionString: process.env.DIRECT_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

const seedState: BuilderState = {
  tables: [
    {
      id: 'table1',
      name: 'Table 1',
      type: 'table',
      fields: [
        { id: 'table1_f1', name: 'Revenue', dataType: 'number' },
        { id: 'table1_f2', name: 'Cost', dataType: 'number' },
        { id: 'table1_f3', name: 'Category', dataType: 'string' },
      ],
    },
    {
      id: 'table2',
      name: 'Table 2',
      type: 'table',
      fields: [
        { id: 'table2_f1', name: 'Quantity', dataType: 'number' },
        { id: 'table2_f2', name: 'Price', dataType: 'number' },
        { id: 'table2_f3', name: 'Label', dataType: 'string' },
      ],
    },
  ],
  conditions: [],
  results: [],
}

async function main() {
  console.log('Seeding database...')
  await db.formula.upsert({
    where: { id: 'seed-formula-1' },
    create: { id: 'seed-formula-1', name: 'Demo Formula', state: seedState },
    update: { name: 'Demo Formula', state: seedState },
  })
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
