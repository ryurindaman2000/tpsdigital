import { NextResponse } from 'next/server';
import { db, writeAuditLog } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

// Helper: bandingkan password (bcrypt atau fallback plain text)
async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  try {
    const bcrypt = await import('bcryptjs');
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
      return await bcrypt.compare(plain, stored);
    }
    return stored === plain;
  } catch {
    return stored === plain;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { nim, password } = body || {};

    if (!nim || !password) {
      return NextResponse.json(
        { message: 'Silakan isi NIM / ID Pemilih dan Password.' },
        { status: 400 }
      );
    }

    const trimmedNim = String(nim).trim();
    const trimmedPass = String(password).trim();
    const lowerNim = trimmedNim.toLowerCase();

    const envAdminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.toLowerCase() : 'admin';
    const envAdminPassword = process.env.ADMIN_PASSWORD || 'admin';

    // ── 1. FAST-PATH OTENTIKASI ADMIN ENV (INSTANT RESPONSE < 50ms) ──
    if (lowerNim === envAdminUsername) {
      if (trimmedPass !== envAdminPassword) {
        writeAuditLog('LOGIN_FAILED', `admin:${trimmedNim}`, '127.0.0.1', 'Password admin salah').catch(() => {});
        return NextResponse.json(
          { message: 'Password Admin tidak sesuai.' },
          { status: 401 }
        );
      }

      const adminUser = {
        nim: trimmedNim,
        name: 'Panitia Pemilihan (Admin)',
        role: 'ADMIN' as const,
      };

      const response = NextResponse.json({
        success: true,
        message: 'Login Admin Berhasil',
        role: 'ADMIN',
        redirectUrl: '/admin/dashboard',
        user: { nim: trimmedNim, name: 'Panitia Pemilihan (Admin)', role: 'ADMIN' },
      });

      await setSessionCookie(response, adminUser);
      writeAuditLog('LOGIN_SUCCESS', trimmedNim, '127.0.0.1', 'Admin login berhasil').catch(() => {});
      return response;
    }

    // ── 2. OTENTIKASI ADMIN DATABASE (POSTGRESQL) ──
    let dbAdmin: any = null;
    try {
      dbAdmin = await db.user.findFirst({
        where: { role: 'ADMIN', nim: lowerNim },
      });
    } catch (e) {
      console.error('[Login DB Admin Error]:', e);
    }

    if (dbAdmin) {
      const isValid = await comparePassword(trimmedPass, dbAdmin.randomPassword);
      if (!isValid) {
        writeAuditLog('LOGIN_FAILED', `admin:${trimmedNim}`, '127.0.0.1', 'Password admin salah').catch(() => {});
        return NextResponse.json(
          { message: 'Password Admin tidak sesuai.' },
          { status: 401 }
        );
      }

      const adminUser = {
        nim: trimmedNim,
        name: dbAdmin.name || dbAdmin.nim,
        role: 'ADMIN' as const,
      };

      const response = NextResponse.json({
        success: true,
        message: 'Login Admin Berhasil',
        role: 'ADMIN',
        redirectUrl: '/admin/dashboard',
        user: { nim: trimmedNim, name: dbAdmin.name || dbAdmin.nim, role: 'ADMIN' },
      });

      await setSessionCookie(response, adminUser);
      writeAuditLog('LOGIN_SUCCESS', trimmedNim, '127.0.0.1', 'Admin login berhasil').catch(() => {});
      return response;
    }

    // ── 2. OTENTIKASI MAHASISWA (VOTER REAL DATABASE VALIDATION) ──
    let voter: any = null;
    try {
      voter = await db.user.findFirst({
        where: { nim: trimmedNim, role: 'VOTER' },
      });
    } catch (dbErr: any) {
      console.error('[Login DB Error]:', dbErr);
      return NextResponse.json(
        { message: 'Gagal terhubung ke database PostgreSQL. Pastikan database aktif.' },
        { status: 500 }
      );
    }

    // WAJIB TERDAFTAR: Jika NIM tidak ada di DB -> TOLAK LOGIN (401)
    if (!voter) {
      writeAuditLog('LOGIN_FAILED', trimmedNim, '127.0.0.1', 'NIM tidak terdaftar').catch(() => {});
      return NextResponse.json(
        { message: `NIM / ID Pemilih "${trimmedNim}" tidak terdaftar di database. Silakan hubungi Petugas TPS.` },
        { status: 401 }
      );
    }

    // WAJIB MATCH: Cek password acak TPS
    const isPasswordValid = await comparePassword(trimmedPass, voter.randomPassword);

    if (!isPasswordValid) {
      writeAuditLog('LOGIN_FAILED', trimmedNim, '127.0.0.1', 'Password acak TPS salah').catch(() => {});
      return NextResponse.json(
        { message: 'Password acak TPS salah. Silakan periksa kembali Kartu Akses Anda.' },
        { status: 401 }
      );
    }

    // CEK STATUS HAK PILIH: Jika sudah memilih -> TOLAK LOGIN (403)
    if (voter.hasVoted) {
      writeAuditLog('LOGIN_FAILED', trimmedNim, '127.0.0.1', 'Hak pilih sudah digunakan').catch(() => {});
      return NextResponse.json(
        { message: 'Hak pilih dengan NIM ini telah digunakan. Anda tidak dapat memilih kembali.' },
        { status: 403 }
      );
    }

    // ── BERHASIL OTENTIKASI VOTER TERDAFTAR ──────────────────
    const voterUser = {
      nim: voter.nim,
      name: voter.name,
      role: 'VOTER' as const,
    };

    const response = NextResponse.json({
      success: true,
      message: 'Login Pemilih Berhasil',
      role: 'VOTER',
      redirectUrl: '/vote',
      user: { id: voter.id, nim: voter.nim, name: voter.name, role: 'VOTER' },
    });

    await setSessionCookie(response, voterUser);
    writeAuditLog('LOGIN_SUCCESS', trimmedNim, '127.0.0.1', `Voter ${voter.name} berhasil login`).catch(() => {});

    return response;

  } catch (globalError: any) {
    console.error('[CRITICAL LOGIN ERROR]:', globalError);
    return NextResponse.json(
      { message: 'Terjadi kesalahan sistem saat otentikasi login.' },
      { status: 500 }
    );
  }
}
