import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

// Prisma CLI ไม่โหลด .env.local อัตโนมัติ — ต้องโหลดเอง
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

const directUrl = process.env.DIRECT_URL
if (!directUrl) throw new Error('DIRECT_URL is not set — run: vercel env pull .env.local')

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
