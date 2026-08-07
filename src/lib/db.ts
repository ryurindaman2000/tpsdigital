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
  action: string,
  actor: string,
  ipAddress?: string,
  details?: string
): Promise<void> {
  try {
    // 1. Simpan audit log ke Firestore
    await addFsDoc('audit_logs', {
      action,
      actor,
      ipAddress: ipAddress || '127.0.0.1',
      details: details || '',
      createdAt: new Date().toISOString(),
    });
  } catch (fsErr) {
    console.error('[Firestore Audit Log Error]:', fsErr);
  }

  try {
    // 2. Fallback simpan ke PostgreSQL jika ada
    const dbAny = db as any;
    if (dbAny.auditLog && typeof dbAny.auditLog.create === 'function') {
      await dbAny.auditLog.create({
        data: { action, actor, ipAddress: ipAddress || null, details: details || null },
      });
    }
  } catch {
    // Silent fallback
  }
}
