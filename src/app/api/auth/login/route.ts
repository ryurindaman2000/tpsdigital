import { NextResponse } from 'next/server';
import { db, writeAuditLog } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { getFsDoc, getFsCollection } from '@/lib/firestore-rest';

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

    // ── 1. OTENTIKASI ADMIN FIRESTORE & ENV ──
    if (lowerNim === envAdminUsername || lowerNim === 'admin') {
      let fsAdminDoc: any = await getFsDoc('users', 'users');
      if (!fsAdminDoc) fsAdminDoc = await getFsDoc('users', 'admin');
      if (!fsAdminDoc) {
        const users = await getFsCollection('users');
        fsAdminDoc = users.find((u: any) => u.role === 'ADMIN' || u.nim === 'admin');
      }

      const activeAdminPassword = fsAdminDoc ? (fsAdminDoc.randomPassword || fsAdminDoc.password || envAdminPassword) : envAdminPassword;
      const isPassCorrect = (trimmedPass === activeAdminPassword) || (trimmedPass === envAdminPassword);

      if (!isPassCorrect) {
        writeAuditLog('LOGIN_FAILED', `admin:${trimmedNim}`, '127.0.0.1', 'Password admin salah').catch(() => {});
        return NextResponse.json(
          { message: 'Password Admin tidak sesuai.' },
          { status: 401 }
        );
      }

      const adminUser = {
        nim: fsAdminDoc?.nim || trimmedNim,
        name: fsAdminDoc?.name || 'Panitia Pemilihan (Admin)',
        role: 'ADMIN' as const,
      };

      const response = NextResponse.json({
        success: true,
        message: 'Login Admin Berhasil',
        role: 'ADMIN',
        redirectUrl: '/admin/dashboard',
        user: adminUser,
      });

      await setSessionCookie(response, adminUser);
      writeAuditLog('LOGIN_SUCCESS', trimmedNim, '127.0.0.1', 'Admin login berhasil').catch(() => {});
      return response;
    }

    // ── 2. OTENTIKASI ADMIN DATABASE (POSTGRESQL) ──
    let dbAdmin: any = null;
    try {
      if (db.user) {
        dbAdmin = await db.user.findFirst({
          where: { role: 'ADMIN', nim: lowerNim },
        });
      }
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
        user: adminUser,
      });

      await setSessionCookie(response, adminUser);
      writeAuditLog('LOGIN_SUCCESS', trimmedNim, '127.0.0.1', 'Admin login berhasil').catch(() => {});
      return response;
    }

    // ── 3. OTENTIKASI PEMILIH (VOTER) DI FIRESTORE ──
    try {
      let fsVoter: any = await getFsDoc('users', lowerNim);
      if (!fsVoter) {
        const usersList = await getFsCollection('users');
        fsVoter = usersList.find(
          (u: any) => String(u.nim || '').trim().toLowerCase() === lowerNim && u.role === 'VOTER'
        );
      }

      if (fsVoter && fsVoter.role === 'VOTER') {
        if (fsVoter.isLocked) {
          writeAuditLog('LOGIN_BLOCKED', lowerNim, '127.0.0.1', 'Akun pemilih terkunci (TPS Tutup)').catch(() => {});
          return NextResponse.json(
            { message: 'Waktu pemungutan suara TPS telah ditutup. Akun Anda saat ini dinonaktifkan oleh Panitia.' },
            { status: 403 }
          );
        }

        const isPassValid = await comparePassword(trimmedPass, fsVoter.randomPassword || fsVoter.password);
        if (!isPassValid) {
          writeAuditLog('LOGIN_FAILED', lowerNim, '127.0.0.1', 'Password pemilih salah').catch(() => {});
          return NextResponse.json(
            { message: 'NIM atau Password yang Anda masukkan salah.' },
            { status: 401 }
          );
        }

        const voterUser = {
          nim: fsVoter.nim,
          name: fsVoter.name || fsVoter.nim,
          role: 'VOTER' as const,
        };

        const response = NextResponse.json({
          success: true,
          message: 'Login Pemilih Berhasil',
          role: 'VOTER',
          redirectUrl: '/vote',
          user: voterUser,
        });

        await setSessionCookie(response, voterUser);
        writeAuditLog('LOGIN_SUCCESS', lowerNim, '127.0.0.1', 'Pemilih login berhasil').catch(() => {});
        return response;
      }
    } catch (fsErr) {
      console.error('[Login Firestore Voter Error]:', fsErr);
    }

    // ── 4. OTENTIKASI PEMILIH (VOTER) POSTGRESQL FALLBACK ──
    let voter: any = null;
    try {
      if (db.user) {
        voter = await db.user.findFirst({
          where: { nim: lowerNim, role: 'VOTER' },
        });
      }
    } catch (e) {
      console.error('[Login DB Voter Error]:', e);
    }

    if (!voter) {
      writeAuditLog('LOGIN_FAILED', lowerNim, '127.0.0.1', 'NIM pemilih tidak ditemukan').catch(() => {});
      return NextResponse.json(
        { message: 'NIM atau Password yang Anda masukkan salah.' },
        { status: 401 }
      );
    }

    const isPassValid = await comparePassword(trimmedPass, voter.randomPassword);
    if (!isPassValid) {
      writeAuditLog('LOGIN_FAILED', lowerNim, '127.0.0.1', 'Password pemilih salah').catch(() => {});
      return NextResponse.json(
        { message: 'NIM atau Password yang Anda masukkan salah.' },
        { status: 401 }
      );
    }

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
      user: voterUser,
    });

    await setSessionCookie(response, voterUser);
    writeAuditLog('LOGIN_SUCCESS', lowerNim, '127.0.0.1', 'Pemilih login berhasil').catch(() => {});
    return response;
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan pada server saat login.' },
      { status: 500 }
    );
  }
}
