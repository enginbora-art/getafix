import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'
import { resolve } from 'path'

// .env'i yükle — Prisma CLI bu dosyayı okurken process.env henüz hazır olmayabilir
config({ path: resolve(__dirname, '.env') })

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
