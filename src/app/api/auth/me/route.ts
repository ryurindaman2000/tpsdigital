import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    // Ambil data user dari JWT session (httpOnly cookie)
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Sesi tidak ditemukan. Silakan login.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        nim: user.nim,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Gagal memverifikasi sesi.' },
      { status: 500 }
    );
  }
}
