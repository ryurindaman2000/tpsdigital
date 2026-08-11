import { NextResponse } from 'next/server';
import { getFsCollection } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

// GET /api/debug-lock
export async function GET() {
  const logs: string[] = [];
  try {
    const users = await getFsCollection('users');
    logs.push(`getFsCollection('users') returned ${users.length} items`);
    if (users.length > 0) {
      logs.push(`First user NIM: ${users[0].nim}, isLocked: ${users[0].isLocked}`);
    }
  } catch (e: any) {
    logs.push(`Error: ${e.message}`);
  }

  return NextResponse.json({ logs });
}
