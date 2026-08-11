import { NextResponse } from 'next/server';
import { setFsDoc, getFsCollection } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

// GET /api/debug-unlock?docId=2250121003
// Test menulis isLocked=false langsung ke Firestore
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('docId') || '2250121003';
  const logs: string[] = [];

  // 1. Cek kondisi dokumen sebelum unlock
  logs.push(`=== Step 1: Read current state of ${docId} ===`);
  try {
    const users = await getFsCollection('users');
    const target = users.find((u: any) => String(u.nim) === docId || String(u.id) === docId);
    if (target) {
      logs.push(`Found: nim=${target.nim}, isLocked=${target.isLocked}, hasVoted=${target.hasVoted}`);
      logs.push(`isLocked type: ${typeof target.isLocked}`);
      logs.push(`isLocked === true: ${target.isLocked === true}`);
      logs.push(`String(isLocked): ${String(target.isLocked)}`);
    } else {
      logs.push(`NOT FOUND in users collection for docId=${docId}`);
    }
  } catch (e: any) {
    logs.push(`Read error: ${e.message}`);
  }

  // 2. Coba tulis isLocked=false
  logs.push(`=== Step 2: Write isLocked=false to users/${docId} ===`);
  let writeOk = false;
  try {
    writeOk = await setFsDoc('users', docId, { isLocked: false });
    logs.push(`setFsDoc result: ${writeOk}`);
  } catch (e: any) {
    logs.push(`Write error: ${e.message}`);
  }

  // 3. Verifikasi setelah tulis
  logs.push(`=== Step 3: Verify isLocked after write ===`);
  try {
    const users2 = await getFsCollection('users');
    const target2 = users2.find((u: any) => String(u.nim) === docId || String(u.id) === docId);
    if (target2) {
      logs.push(`After write: isLocked=${target2.isLocked}`);
    } else {
      logs.push(`NOT FOUND after write`);
    }
  } catch (e: any) {
    logs.push(`Verify error: ${e.message}`);
  }

  return NextResponse.json({ logs, writeOk });
}
