import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

// GET /api/debug-lock
export async function GET() {
  const logs: string[] = [];
  const dbIds = ['default', '(default)'];

  for (const dbId of dbIds) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${dbId}/documents/users?key=${API_KEY}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      logs.push(`DB [${dbId}] status: ${res.status}`);
      logs.push(`DB [${dbId}] snippet: ${text.substring(0, 200)}`);
    } catch (e: any) {
      logs.push(`DB [${dbId}] err: ${e.message}`);
    }
  }

  return NextResponse.json({ logs });
}
