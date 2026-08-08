import { PrismaClient } from '@prisma/client';
import { addFsDoc } from './firestore-rest';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

let prismaInstance: PrismaClient | null = null;

try {
  if (process.env.DATABASE_URL) {
    prismaInstance =
      globalForPrisma.prisma ||
      new PrismaClient({
        log: ['error'],
      });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance;
    }
  }
} catch (e) {
  console.error('[Prisma Init Error]:', e);
}

export const db = (prismaInstance || {}) as PrismaClient;

export async function writeAuditLog(
  _action: string,
  _actor: string,
  _ipAddress?: string,
  _details?: string
): Promise<void> {
  // Disabilitas pencatatan audit log per permintaan pengguna
  return;
}
