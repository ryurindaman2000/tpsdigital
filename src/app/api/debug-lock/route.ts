import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

// GET /api/debug-lock
export async function GET() {
  const logs: string[] = [];
  logs.push(`PROJECT_ID: ${PROJECT_ID}`);
  
  // Test 1: pageSize=1000
  const url1 = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents/users?pageSize=1000&key=${API_KEY}`;
  try {
    const res1 = await fetch(url1, { cache: 'no-store' });
    const json1 = await res1.json();
    logs.push(`pageSize=1000 Status: ${res1.status}`);
    logs.push(`pageSize=1000 document count: ${json1.documents ? json1.documents.length : 0}`);
    if (json1.error) logs.push(`Error msg: ${json1.error.message}`);
  } catch (e: any) {
    logs.push(`Fetch 1 error: ${e.message}`);
  }

  // Test 2: default fetch
  const url2 = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents/users?key=${API_KEY}`;
  try {
    const res2 = await fetch(url2, { cache: 'no-store' });
    const json2 = await res2.json();
    logs.push(`default Status: ${res2.status}`);
    logs.push(`default document count: ${json2.documents ? json2.documents.length : 0}`);
    if (json2.nextPageToken) logs.push(`Has nextPageToken: ${json2.nextPageToken.substring(0, 20)}...`);
  } catch (e: any) {
    logs.push(`Fetch 2 error: ${e.message}`);
  }

  return NextResponse.json({ logs });
}
