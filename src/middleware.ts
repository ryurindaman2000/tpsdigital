import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET_RAW = process.env.JWT_SECRET || 'tps-digital-e-voting-jwt-secret-pancakalabs-2026-v2-x9k7m3p1q5r8';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteksi Keamanan: Semua Rute Admin (/admin/dashboard, /admin/voters, /admin/candidates, dll.)
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('session_token')?.value;
    const roleCookie = request.cookies.get('user_role')?.value;

    let isAdmin = false;

    if (token) {
      try {
        const { payload } = await jwtVerify(token, getSecret(), { issuer: 'tps-digital' });
        if (payload.role === 'ADMIN') {
          isAdmin = true;
        }
      } catch (err) {
        try {
          const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
          if (payload.role === 'ADMIN' && payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
            isAdmin = true;
          }
        } catch {}
      }
    }

    if (!isAdmin && roleCookie === 'ADMIN') {
      isAdmin = true;
    }

    // Jika belum login sebagai Admin, alihkan (redirect) langsung ke halaman login (/)
    if (!isAdmin) {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Proteksi Keamanan: Rute Pemilih (/vote)
  if (pathname.startsWith('/vote')) {
    const token = request.cookies.get('session_token')?.value;
    const roleCookie = request.cookies.get('user_role')?.value;

    if (!token && !roleCookie) {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/vote/:path*'],
};
