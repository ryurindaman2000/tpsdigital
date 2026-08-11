import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

// GET /api/debug-lock - Debug Firestore PATCH isLocked on a test document
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('docId') || '2250121003';

  const logs: string[] = [];
  logs.push(`PROJECT_ID: ${PROJECT_ID}`);
  logs.push(`API_KEY prefix: ${API_KEY.substring(0, 8)}...`);

  // Try PATCH with updateMask
  const docPath = `users/${docId}`;
  const fieldPaths = `updateMask.fieldPaths=isLocked`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${fieldPaths}&key=${API_KEY}`;

  logs.push(`URL: ${url}`);

  const payload = {
    fields: {
      isLocked: { booleanValue: true },
    },
  };

  let responseStatus = 0;
  let responseBody = '';
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    responseStatus = res.status;
    responseBody = await res.text();
    logs.push(`Response Status: ${responseStatus}`);
    logs.push(`Response Body: ${responseBody}`);
  } catch (err: any) {
    logs.push(`Fetch Error: ${err.message}`);
  }

  return NextResponse.json({
    success: responseStatus >= 200 && responseStatus < 300,
    logs,
    responseStatus,
    responseBodySnippet: responseBody.substring(0, 500),
  });
}
