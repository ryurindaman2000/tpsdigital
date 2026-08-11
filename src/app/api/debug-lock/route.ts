import { NextResponse } from 'next/server';
import { getFsCollection } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

// GET /api/debug-lock
export async function GET() {
  const logs: string[] = [];
  try {
    const users = await getFsCollection('users');
    logs.push(`Total users in collection: ${users.length}`);

    if (users.length > 0) {
      logs.push(`Sample user keys: ${Object.keys(users[0]).join(', ')}`);
      logs.push(`Sample user [0]: ${JSON.stringify(users[0])}`);

      const match = users.find((u: any) => String(u.nim) === '2250121003' || String(u.id) === '2250121003');
      logs.push(`Match 2250121003: ${match ? JSON.stringify(match) : 'NULL'}`);
    }
  } catch (e: any) {
    logs.push(`Error: ${e.message}`);
  }

  return NextResponse.json({ logs });
}
