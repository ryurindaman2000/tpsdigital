import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFsCollection } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/audit — Ambil daftar audit log dari Firestore
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);

    // 1. Ambil dari Firestore REST
    try {
      const logs = await getFsCollection('audit_logs');
      if (logs.length > 0) {
        logs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const data = logs.slice(0, limit);
        return NextResponse.json({ success: true, data, total: data.length });
      }
    } catch (fsErr) {
      console.error('[Firestore Audit Logs GET Error]:', fsErr);
    }

    // 2. Fallback aman ke PostgreSQL
    let logsArray: any[] = [];
    try {
      const dbAny = db as any;
      if (dbAny.auditLog && typeof dbAny.auditLog.findMany === 'function') {
        logsArray = await dbAny.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
      }
    } catch {
      // Ignore
    }

    return NextResponse.json({ success: true, data: logsArray, total: logsArray.length });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [], total: 0 });
  }
}
