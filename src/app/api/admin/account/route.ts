import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, writeAuditLog } from '@/lib/db';

// Helper: Ambil atau buat akun admin di Firestore / Database
async function getOrInitAdminUser() {
  // 1. Coba dari Firestore terlebih dahulu
  try {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const { db: fdb } = await import('@/lib/firebase');

    const adminRef = doc(fdb, 'users', 'admin');
    const docSnap = await getDoc(adminRef);

    if (docSnap.exists()) {
      return { id: 'admin', ...docSnap.data() };
    } else {
      const defaultAdmin = {
        nim: process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.toLowerCase() : 'admin',
        name: 'Panitia Pemilihan (Admin)',
        randomPassword: process.env.ADMIN_PASSWORD || 'admin',
        role: 'ADMIN',
        hasVoted: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(adminRef, defaultAdmin);
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

    // Verifikasi Password Saat Ini
    if (String(currentPassword).trim() !== activePassword) {
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

    // 1. Perbarui data Akun Admin di Firestore
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');

      await setDoc(doc(fdb, 'users', 'admin'), {
        nim: updatedUsername,
        name: updatedUsername === 'admin' ? 'Panitia Pemilihan (Admin)' : updatedUsername,
        randomPassword: updatedPassword,
        role: 'ADMIN',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fsErr) {
      console.error('[Firestore Admin Account Update Error]:', fsErr);
    }

    // 2. Try Update ke PostgreSQL (jika PostgreSQL tersedia)
    try {
      if (db.user && adminUser && adminUser.id && adminUser.id !== 'admin') {
        await db.user.update({
          where: { id: adminUser.id },
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
      message: 'Akun admin berhasil diperbarui! Gunakan username & password baru untuk login.',
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
