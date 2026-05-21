import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

// Prisma CLI ไม่โหลด .env.local อัตโนมัติ — ต้องโหลดเอง
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

// generate ไม่ต้องใช้ DIRECT_URL — ปล่อยให้ migration commands error เองถ้าไม่มี
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    // ใช้ DIRECT_URL (non-pooled) สำหรับ migrations
    url: directUrl,
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
})
