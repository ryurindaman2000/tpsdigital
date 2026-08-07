import { NextResponse } from 'next/server';
import { db, writeAuditLog } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getFsCollection, addFsDoc, setFsDoc, deleteFsDoc } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper: Hasilkan Password Acak 6 Karakter Unik (Huruf Kapital + Angka)
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET /api/voters - Ambil daftar pemilih (Firestore / PostgreSQL)
export async function GET() {
  try {
    // 1. Ambil dari Firestore via REST (Instant < 30ms)
    try {
      const users = await getFsCollection('users');
      const voters = users.filter((u: any) => u.role === 'VOTER');

      const data = voters.map((v: any) => ({
        id: v.id,
        nim: v.nim,
        name: v.name,
        randomPassword: v.randomPassword || '***',
        hasVoted: v.hasVoted || false,
        votedAt: v.votedAt || null,
        createdAt: v.createdAt || null,
      }));
      return NextResponse.json({ success: true, data });
    } catch (fsErr) {
      console.error('[Firestore Voters GET Fallback]:', fsErr);
    }

    // 2. Fallback aman ke PostgreSQL
    let rawVoters: any[] = [];
    try {
      if (db.user) {
        rawVoters = await db.user.findMany({
          where: { role: 'VOTER' },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Voters GET Ignored]:', pgErr);
    }

    const voters = rawVoters.map((voter: any) => ({
      id: voter.id,
      nim: voter.nim,
      name: voter.name,
      randomPassword: voter.randomPassword || generateRandomPassword(),
      hasVoted: voter.hasVoted || false,
      votedAt: voter.votedAt || null,
      createdAt: voter.createdAt || null,
    }));

    return NextResponse.json({ success: true, data: voters });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [] });
  }
}

// POST /api/voters - Tambah pemilih baru / import bulk dari Excel
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ── SUPPORT BULK INSERT BATCH DARI EXCEL ──
    if (body.bulk && Array.isArray(body.voters)) {
      const voters: Array<{ nim: string; name: string }> = body.voters;
      if (voters.length === 0) {
        return NextResponse.json({ success: true, count: 0, duplicateList: [] });
      }

      // Ambil seluruh users dari Firestore
      const existingUsers = await getFsCollection('users');
      const existingNimSet = new Set(existingUsers.map((u: any) => String(u.nim).trim()));

      const duplicateList: string[] = [];
      let successCount = 0;

      for (const voter of voters) {
        const trimmedNim = String(voter.nim || '').trim();
        const trimmedName = String(voter.name || '').trim();
        if (!trimmedNim || !trimmedName) continue;

        if (existingNimSet.has(trimmedNim)) {
          duplicateList.push(`${trimmedNim} - ${trimmedName}`);
        } else {
          existingNimSet.add(trimmedNim);
          const pwd = generateRandomPassword();

          // Simpan ke Firestore
          await addFsDoc('users', {
            nim: trimmedNim,
            name: trimmedName,
            randomPassword: pwd,
            role: 'VOTER',
            hasVoted: false,
            createdAt: new Date().toISOString(),
          });
          successCount++;
        }
      }

      const adminUser = await getSessionUser();
      await writeAuditLog(
        'VOTER_BULK_IMPORT',
        adminUser?.nim || 'admin',
        undefined,
        `Import Excel: ${successCount} berhasil, ${duplicateList.length} duplikat`
      );

      return NextResponse.json({
        success: true,
        total: voters.length,
        successCount,
        duplicateCount: duplicateList.length,
        duplicateList,
      });
    }

    // ── SINGLE INSERT (FORM HANDLER) ──
    const { nim, name, randomPassword } = body;

    if (!nim || !name) {
      return NextResponse.json(
        { success: false, message: 'NIM/ID dan Nama Pemilih wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedNim = String(nim).trim();
    const trimmedName = String(name).trim();

    let plainPassword = String(randomPassword || '').trim();
    if (!plainPassword || plainPassword.startsWith('$2b$') || plainPassword.length > 10) {
      plainPassword = generateRandomPassword();
    }

    // Cek duplikasi di Firestore
    const existingUsers = await getFsCollection('users');
    const isDuplicate = existingUsers.some((u: any) => String(u.nim).trim() === trimmedNim);

    if (isDuplicate) {
      return NextResponse.json(
        { success: false, message: `NIM ${trimmedNim} sudah terdaftar.` },
        { status: 400 }
      );
    }

    // Simpan ke Firestore
    const newDoc = await addFsDoc('users', {
      nim: trimmedNim,
      name: trimmedName,
      randomPassword: plainPassword,
      role: 'VOTER',
      hasVoted: false,
      createdAt: new Date().toISOString(),
    });

    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_ADDED',
      adminUser?.nim || 'admin',
      undefined,
      `Voter baru: ${trimmedNim} - ${trimmedName}`
    );

    return NextResponse.json(
      {
        success: true,
        data: newDoc || { nim: trimmedNim, name: trimmedName, randomPassword: plainPassword },
        plainPassword,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating voter:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan data pemilih.' },
      { status: 500 }
    );
  }
}

// DELETE /api/voters - Hapus pemilih terdaftar
export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar ID yang ingin dihapus tidak valid.' },
        { status: 400 }
      );
    }

    // Hapus dari Firestore
    for (const id of ids) {
      await deleteFsDoc('users', String(id));
    }

    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_DELETED',
      adminUser?.nim || 'admin',
      undefined,
      `Hapus ${ids.length} voter`
    );

    return NextResponse.json({ success: true, message: `${ids.length} data berhasil dihapus.` });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus data pemilih.' },
      { status: 500 }
    );
  }
}
