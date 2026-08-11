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
      const voters = users.filter(
        (u: any) => (u.role === 'VOTER' || (!u.role && u.nim !== 'admin')) && u.nim
      );

      const data = voters.map((v: any) => ({
        id: v.id,
        nim: v.nim,
        name: v.name,
        randomPassword: v.randomPassword || '***',
        hasVoted: v.hasVoted || false,
        isLocked: v.isLocked || false,
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

      // Simpan ke Firestore secara BATCH (Massal & Sangat Hemat Quota)
      // Pembagian batch per 100 item agar tidak melebihi payload limit
      const chunkSize = 100;
      for (let i = 0; i < voters.length; i += chunkSize) {
        const chunk = voters.slice(i, i + chunkSize);
        
        await Promise.all(
          chunk.map(async (voter) => {
            const trimmedNim = String(voter.nim || '').trim();
            const trimmedName = String(voter.name || '').trim();
            if (!trimmedNim || !trimmedName) return;

            if (existingNimSet.has(trimmedNim)) {
              duplicateList.push(`${trimmedNim} - ${trimmedName}`);
            } else {
              existingNimSet.add(trimmedNim);
              const pwd = generateRandomPassword();

              // Gunakan setFsDoc dengan ID NIM agar idempotent dan super cepat
              await setFsDoc('users', trimmedNim, {
                nim: trimmedNim,
                name: trimmedName,
                randomPassword: pwd,
                role: 'VOTER',
                hasVoted: false,
                createdAt: new Date().toISOString(),
              });
              successCount++;
            }
          })
        );
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

// PUT /api/voters - Edit/Update data pemilih (NIM, Nama, Password)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, nim, name, password } = body;

    if (!id || !nim || !name) {
      return NextResponse.json(
        { success: false, message: 'ID, NIM/ID Pemilih, dan Nama Pemilih wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedNim = String(nim).trim();
    const trimmedName = String(name).trim();
    const trimmedPassword = String(password || '').trim();

    // Cek apakah NIM diubah dan sudah dipakai voter lain
    const existingUsers = await getFsCollection('users');
    const isDuplicate = existingUsers.some(
      (u: any) => String(u.id) !== String(id) && String(u.nim).trim() === trimmedNim
    );

    if (isDuplicate) {
      return NextResponse.json(
        { success: false, message: `NIM/ID Pemilih ${trimmedNim} sudah digunakan oleh pemilih lain.` },
        { status: 400 }
      );
    }

    // Update di Firestore
    const updateData: Record<string, any> = {
      nim: trimmedNim,
      name: trimmedName,
      role: 'VOTER',
    };
    if (trimmedPassword) {
      updateData.randomPassword = trimmedPassword;
    }

    await setFsDoc('users', String(id), updateData);

    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_UPDATED',
      adminUser?.nim || 'admin',
      undefined,
      `Update voter [${id}]: ${trimmedNim} - ${trimmedName}`
    );

    return NextResponse.json({
      success: true,
      message: 'Data pemilih berhasil diperbarui.',
      data: { id, nim: trimmedNim, name: trimmedName, randomPassword: trimmedPassword },
    });
  } catch (error: any) {
    console.error('Error updating voter:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui data pemilih.' },
      { status: 500 }
    );
  }
}

// PATCH /api/voters - Kunci / Buka Akses Login Pemilih (Lock / Unlock Account)
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { isLocked, target = 'unvoted', ids = [] } = body || {};

    if (typeof isLocked !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Status isLocked wajib diisi (true/false).' },
        { status: 400 }
      );
    }

    const existingUsers = await getFsCollection('users');
    const voterUsers = existingUsers.filter((u: any) => u.role === 'VOTER' || (!u.role && u.nim !== 'admin'));

    let targetVoters: any[] = [];
    if (target === 'unvoted') {
      // Hanya pemilih yang BELUM MEMILIH
      targetVoters = voterUsers.filter((u: any) => !u.hasVoted);
    } else if (target === 'ids' && Array.isArray(ids) && ids.length > 0) {
      // Pemilih terpilih berdasarkan ID atau NIM
      const stringIds = ids.map((i: any) => String(i));
      targetVoters = voterUsers.filter(
        (u: any) =>
          stringIds.includes(String(u.id)) ||
          stringIds.includes(String(u.nim))
      );
    } else if (target === 'all') {
      // Semua pemilih
      targetVoters = voterUsers;
    }

    if (targetVoters.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada data pemilih yang sesuai untuk diperbarui status kuncinya.',
        updatedCount: 0,
      });
    }

    // Eksekusi Update Batch Paralel (Maksimal 100 per Chunks)
    const chunkSize = 100;
    let updatedCount = 0;

    for (let i = 0; i < targetVoters.length; i += chunkSize) {
      const chunk = targetVoters.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (v: any) => {
          const docId = String(v.nim || v.id);
          const ok = await setFsDoc('users', docId, {
            isLocked: isLocked,
          });
          return ok;
        })
      );
      updatedCount += results.filter(Boolean).length;
    }

    if (updatedCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Gagal memperbarui status kunci: semua operasi write ke Firestore gagal. Cek koneksi ke database.',
        updatedCount: 0,
      });
    }

    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_LOCK_STATUS_CHANGED',
      adminUser?.nim || 'admin',
      undefined,
      `${isLocked ? 'KUNCI' : 'BUKA'} akun pemilih (${target}): ${updatedCount} akun`
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil ${isLocked ? 'mengunci' : 'membuka'} akses login ${updatedCount} akun pemilih.`,
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error changing voter lock status:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui status kunci pemilih.' },
      { status: 500 }
    );
  }
}
