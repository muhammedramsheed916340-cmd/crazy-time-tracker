import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// On Vercel/serverless, SQLite file paths may not be writable.
// Use /tmp for the database file if the default path doesn't work.
// The DATABASE_URL env var should be set to a writable path on Vercel.
const dbUrl = process.env.DATABASE_URL || 'file:/tmp/crazytime.db'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
