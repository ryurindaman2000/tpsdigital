import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, writeAuditLog } from '@/lib/db';

// Helper: Ambil atau buat akun admin di database Supabase (tabel `users`)
async function getOrInitAdminUser() {
  try {
    let adminUser = await db.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      // Buat akun admin pertama kali di tabel `users` Supabase jika belum ada
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
  } catch (err) {
    console.error('[getOrInitAdminUser Error]:', err);
    return null;
  }
}

// GET: Ambil username admin dari tabel `users` Supabase
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 401 });
    }

    const adminUser = await getOrInitAdminUser();
    return NextResponse.json({
      success: true,
      username: adminUser ? adminUser.nim : (process.env.ADMIN_USERNAME || 'admin'),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data akun admin.' },
      { status: 500 }
    );
  }
}

// POST: Ubah Akun Admin (Username & Password) langsung di tabel `users` Supabase PostgreSQL
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

    const adminUser = await getOrInitAdminUser();
    const activePassword = adminUser ? adminUser.randomPassword : (process.env.ADMIN_PASSWORD || 'admin');

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

    // Perbarui data Akun Admin di tabel `users` Supabase
    if (adminUser) {
      await db.user.update({
        where: { id: adminUser.id },
        data: {
          nim: updatedUsername,
          name: updatedUsername === 'admin' ? 'Panitia Pemilihan (Admin)' : updatedUsername,
          randomPassword: updatedPassword,
        },
      });
    } else {
      await db.user.create({
        data: {
          nim: updatedUsername,
          name: 'Panitia Pemilihan (Admin)',
          randomPassword: updatedPassword,
          role: 'ADMIN',
        },
      });
    }

    // Write audit log
    await writeAuditLog(
      'ADMIN_ACCOUNT_UPDATED',
      session.nim || updatedUsername,
      '127.0.0.1',
      `Akun admin diperbarui di Supabase PostgreSQL. Username baru: ${updatedUsername}`
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Akun admin berhasil diperbarui di database Supabase! Gunakan username & password baru untuk login.',
      username: updatedUsername,
    });
  } catch (error: any) {
    console.error('[AdminAccount API Error]:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem saat memperbarui akun admin.' },
      { status: 500 }
    );
  }
}
