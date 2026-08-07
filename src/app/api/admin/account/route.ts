import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, writeAuditLog } from '@/lib/db';
import { getFsDoc, setFsDoc, getFsCollection } from '@/lib/firestore-rest';

// Helper: Ambil atau buat akun admin di Firestore / Database
async function getOrInitAdminUser() {
  // 1. Coba dari Firestore via REST (Cek doc 'users', 'admin', atau query role 'ADMIN')
  try {
    let fsAdmin = await getFsDoc('users', 'users');
    if (!fsAdmin) fsAdmin = await getFsDoc('users', 'admin');
    if (!fsAdmin) {
      const users = await getFsCollection('users');
      fsAdmin = users.find((u: any) => u.role === 'ADMIN' || u.nim === 'admin');
    }

    if (fsAdmin) {
      return fsAdmin;
    } else {
      const defaultAdmin = {
        nim: process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.toLowerCase() : 'admin',
        name: 'Panitia Pemilihan (Admin)',
        randomPassword: process.env.ADMIN_PASSWORD || 'admin',
        role: 'ADMIN',
        hasVoted: false,
        createdAt: new Date().toISOString(),
      };
      await setFsDoc('users', 'users', defaultAdmin);
      await setFsDoc('users', 'admin', defaultAdmin);
      return { id: 'admin', ...defaultAdmin };
    }
  } catch (fsErr) {
    console.error('[Firestore getOrInitAdminUser Error]:', fsErr);
  }

  // 2. Fallback ke PostgreSQL
  try {
    if (db.user) {
      let adminUser = await db.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (!adminUser) {
        adminUser = await db.user.create({
          data: {
            nim: process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.toLowerCase() : 'admin',
            name: 'Panitia Pemilihan (Admin)',
            randomPassword: process.env.ADMIN_PASSWORD || 'admin',
            role: 'ADMIN',
          },
        });
      }
      return adminUser;
    }
  } catch (err) {
    console.warn('[PostgreSQL getOrInitAdminUser Ignored]:', err);
  }

  return null;
}

// GET: Ambil username admin dari Firestore / Env
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 401 });
    }

    const adminUser: any = await getOrInitAdminUser();
    return NextResponse.json({
      success: true,
      username: adminUser ? adminUser.nim : (process.env.ADMIN_USERNAME || 'admin'),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      username: process.env.ADMIN_USERNAME || 'admin',
    });
  }
}

// POST: Ubah Akun Admin (Username & Password) di Firestore
export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newUsername, newPassword } = body || {};

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, message: 'Password saat ini wajib diisi untuk konfirmasi keamanan.' },
        { status: 400 }
      );
    }

    const adminUser: any = await getOrInitAdminUser();
    const activePassword = adminUser ? (adminUser.randomPassword || adminUser.password) : (process.env.ADMIN_PASSWORD || 'admin');

    // Verifikasi Password Saat Ini (Boleh match password aktif di Firestore ATAU password env)
    const isPassValid = (String(currentPassword).trim() === activePassword) || 
                        (String(currentPassword).trim() === (process.env.ADMIN_PASSWORD || 'admin'));

    if (!isPassValid) {
      return NextResponse.json(
        { success: false, message: 'Password saat ini tidak sesuai.' },
        { status: 400 }
      );
    }

    const updatedUsername = newUsername && String(newUsername).trim() ? String(newUsername).trim().toLowerCase() : (adminUser?.nim || 'admin');
    const updatedPassword = newPassword && String(newPassword).trim() ? String(newPassword).trim() : activePassword;

    if (!updatedUsername) {
      return NextResponse.json(
        { success: false, message: 'Username admin tidak boleh kosong.' },
        { status: 400 }
      );
    }

    // 1. Perbarui data Akun Admin di Firestore (Update kedua dokumen: 'users' dan 'admin')
    try {
      const adminData = {
        nim: updatedUsername,
        name: updatedUsername === 'admin' ? 'Panitia Pemilihan (Admin)' : updatedUsername,
        randomPassword: updatedPassword,
        role: 'ADMIN',
        updatedAt: new Date().toISOString(),
      };

      await setFsDoc('users', 'users', adminData);
      await setFsDoc('users', 'admin', adminData);
      if (adminUser && adminUser.id && adminUser.id !== 'users' && adminUser.id !== 'admin') {
        await setFsDoc('users', adminUser.id, adminData);
      }
    } catch (fsErr) {
      console.error('[Firestore Admin Account Update Error]:', fsErr);
    }

    // 2. Try Update ke PostgreSQL (jika PostgreSQL tersedia)
    try {
      if (db.user && adminUser && adminUser.id && adminUser.id !== 'admin' && adminUser.id !== 'users') {
        await db.user.update({
          where: { id: String(adminUser.id) },
          data: {
            nim: updatedUsername,
            name: updatedUsername === 'admin' ? 'Panitia Pemilihan (Admin)' : updatedUsername,
            randomPassword: updatedPassword,
          },
        });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Admin Account Update Ignored]:', pgErr);
    }

    // Write audit log
    await writeAuditLog(
      'ADMIN_ACCOUNT_UPDATED',
      session.nim || updatedUsername,
      '127.0.0.1',
      `Akun admin diperbarui. Username baru: ${updatedUsername}`
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Akun admin berhasil diperbarui di Firestore! Gunakan username & password baru untuk login.',
      username: updatedUsername,
    });
  } catch (error: any) {
    console.error('[AdminAccount API Error]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui akun admin.' },
      { status: 500 }
    );
  }
}
