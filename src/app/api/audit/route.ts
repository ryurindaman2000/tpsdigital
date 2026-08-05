import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeAuditLog } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/audit — Ambil daftar audit log (hanya Admin, dilindungi middleware)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);
    const action = searchParams.get('action') || undefined;

    // Gunakan raw query agar bekerja sebelum/sesudah prisma generate
    const dbAny = db as any;
    if (dbAny.auditLog && typeof dbAny.auditLog.findMany === 'function') {
      const logs = await dbAny.auditLog.findMany({
        where: action ? { action } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return NextResponse.json({ success: true, data: logs, total: logs.length });
    }

    // Fallback raw SQL
    const logs = await db.$queryRaw`
      SELECT id, action, actor, ip_address as "ipAddress", details, created_at as "createdAt"
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const logsArray = logs as any[];
    return NextResponse.json({ success: true, data: logsArray, total: logsArray.length });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil audit log.' },
      { status: 500 }
    );
  }
}
