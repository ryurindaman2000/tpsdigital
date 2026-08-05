import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

let prismaInstance: PrismaClient | null = null;

try {
  prismaInstance =
    globalForPrisma.prisma ||
    new PrismaClient({
      log: ['error'],
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
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
    const dbAny = db as any;
    if (dbAny.auditLog && typeof dbAny.auditLog.create === 'function') {
      await dbAny.auditLog.create({
        data: { action, actor, ipAddress: ipAddress || null, details: details || null },
      });
    }
  } catch {
    // Audit log silent fallback
  }
}
