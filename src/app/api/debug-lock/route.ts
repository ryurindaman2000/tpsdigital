import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

// GET /api/debug-lock - Debug Firestore PATCH isLocked - test all possible DB IDs
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('docId') || '2250121003';

  const logs: string[] = [];
  logs.push(`PROJECT_ID: ${PROJECT_ID}`);
  logs.push(`API_KEY prefix: ${API_KEY.substring(0, 8)}...`);

  const DB_IDS_TO_TEST = ['(default)', 'default', PROJECT_ID, 'jambulayam'];
  const results: any[] = [];

  const payload = {
    fields: {
      isLocked: { booleanValue: true },
    },
  };

  for (const dbId of DB_IDS_TO_TEST) {
    const docPath = `users/${docId}`;
    const fieldPaths = `updateMask.fieldPaths=isLocked`;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${dbId}/documents/${docPath}?${fieldPaths}&key=${API_KEY}`;

    logs.push(`--- Testing WRITE DB: ${dbId} ---`);

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      const responseBody = await res.text();
      logs.push(`Status: ${res.status}`);
      logs.push(`Body snippet: ${responseBody.substring(0, 300)}`);
      results.push({ dbId, status: res.status, ok: res.ok, body: responseBody.substring(0, 300) });
    } catch (err: any) {
      logs.push(`Fetch Error: ${err.message}`);
      results.push({ dbId, status: 0, ok: false, error: err.message });
    }
  }

  // Also test GET to see which DB ID currently READS successfully
  logs.push('--- Testing GET (READ) on each DB ID ---');
  const readResults: any[] = [];
  for (const dbId of DB_IDS_TO_TEST) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${dbId}/documents/users/${docId}?key=${API_KEY}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      logs.push(`READ [${dbId}] -> Status ${res.status}`);
      readResults.push({ dbId, status: res.status, ok: res.ok });
    } catch (err: any) {
      logs.push(`READ [${dbId}] -> Error: ${err.message}`);
    }
  }

  return NextResponse.json({ logs, writeResults: results, readResults });
}
