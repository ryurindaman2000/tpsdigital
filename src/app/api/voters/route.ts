import { NextResponse } from 'next/server';
import { db, writeAuditLog } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Helper: Hasilkan Password Acak 6 Karakter Unik (Huruf Kapital + Angka)
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Hindari karakter I, O, 0, 1 yang membingungkan saat dicetak
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET /api/voters - Ambil daftar pemilih dari PostgreSQL & bersihkan hash lama jika ada
export async function GET() {
  try {
    const rawVoters = await db.user.findMany({
      where: { role: 'VOTER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nim: true,
        name: true,
        randomPassword: true,
        hasVoted: true,
        votedAt: true,
        createdAt: true,
      },
    });

    // Otomatis perbaiki & bersihkan data voter lama yang password-nya masih berupa hash bcrypt ($2b$...)
    const voters = await Promise.all(
      rawVoters.map(async (voter) => {
        let pwd = voter.randomPassword || '';
        // Jika password berupa hash bcrypt lama ($2b$...) atau terlalu panjang (> 10 karakter), ganti dengan password 6 karakter rapi
        if (!pwd || pwd.startsWith('$2b$') || pwd.startsWith('$2a$') || pwd.length > 10) {
          pwd = generateRandomPassword();
          try {
            await db.user.update({
              where: { id: voter.id },
              data: { randomPassword: pwd },
            });
          } catch (e) {
            console.error('[Voters Clean Password Error]:', e);
          }
        }
        return {
          ...voter,
          randomPassword: pwd,
        };
      })
    );

    return NextResponse.json({ success: true, data: voters });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data pemilih dari database.' },
      { status: 500 }
    );
  }
}

// POST /api/voters - Tambah pemilih baru (Password acak 6 karakter rapi)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ── SUPPORT BULK INSERT BATCH DARI EXCEL ──
    if (body.bulk && Array.isArray(body.voters)) {
      const voters: Array<{ nim: string; name: string }> = body.voters;
      if (voters.length === 0) {
        return NextResponse.json({ success: true, count: 0, duplicateList: [] });
      }

      // Ambil daftar NIM yang sudah terdaftar di database sekaligus
      const nims = voters.map((v) => String(v.nim).trim());
      const existingUsers = await db.user.findMany({
        where: { nim: { in: nims } },
        select: { nim: true },
      });
      const existingNimSet = new Set(existingUsers.map((u) => u.nim));

      const newVotersData: Array<{ nim: string; name: string; randomPassword: string }> = [];
      const duplicateList: string[] = [];

      for (const voter of voters) {
        const trimmedNim = String(voter.nim || '').trim();
        const trimmedName = String(voter.name || '').trim();
        if (!trimmedNim || !trimmedName) continue;

        if (existingNimSet.has(trimmedNim)) {
          duplicateList.push(`${trimmedNim} - ${trimmedName}`);
        } else {
          existingNimSet.add(trimmedNim); // Cegah duplikasi di dalam file yang sama
          newVotersData.push({
            nim: trimmedNim,
            name: trimmedName,
            randomPassword: generateRandomPassword(),
          });
        }
      }

      let successCount = 0;
      if (newVotersData.length > 0) {
        const result = await db.user.createMany({
          data: newVotersData,
          skipDuplicates: true,
        });
        successCount = result.count;
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

    // Jika password tidak dikirim atau berupa hash, generate 6 karakter unik
    let plainPassword = String(randomPassword || '').trim();
    if (!plainPassword || plainPassword.startsWith('$2b$') || plainPassword.length > 10) {
      plainPassword = generateRandomPassword();
    }

    // Cek duplikasi NIM
    const existing = await db.user.findUnique({
      where: { nim: trimmedNim },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `NIM ${trimmedNim} sudah terdaftar.` },
        { status: 400 }
      );
    }

    const voter = await db.user.create({
      data: {
        nim: trimmedNim,
        name: trimmedName,
        randomPassword: plainPassword, // Simpan kode acak 6 karakter bersih
      },
      select: {
        id: true,
        nim: true,
        name: true,
        randomPassword: true,
        hasVoted: true,
        createdAt: true,
      },
    });

    // Catat audit log
    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_ADDED',
      adminUser?.nim || 'admin',
      undefined,
      `Voter baru: ${trimmedNim} - ${trimmedName}`
    );

    return NextResponse.json(
      { success: true, data: voter, plainPassword },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error prisma create voter:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan data ke PostgreSQL.' },
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

    await db.user.deleteMany({
      where: { id: { in: ids } },
    });

    // Catat audit log
    const adminUser = await getSessionUser();
    await writeAuditLog(
      'VOTER_DELETED',
      adminUser?.nim || 'admin',
      undefined,
      `Hapus ${ids.length} voter: [${ids.join(', ')}]`
    );

    return NextResponse.json({ success: true, message: `${ids.length} data berhasil dihapus.` });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus data dari PostgreSQL.' },
      { status: 500 }
    );
  }
}
