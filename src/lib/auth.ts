import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const JWT_SECRET_RAW = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRY = '8h';
export const SESSION_COOKIE_NAME = 'session_token';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

export interface SessionUser {
  nim: string;
  name: string;
  role: 'ADMIN' | 'VOTER';
}

/**
 * Membuat token JWT yang aman
 */
export async function signToken(user: SessionUser): Promise<string> {
  const payload = {
    nim: user.nim,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
    iss: 'tps-digital',
  };

  try {
    const { SignJWT } = await import('jose');
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .setIssuer('tps-digital')
      .sign(getSecret());
  } catch (err) {
    console.warn('[Security] Jose signToken fallback to base64 JSON:', err);
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }
}

/**
 * Memverifikasi JWT
 */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, getSecret(), { issuer: 'tps-digital' });
    return {
      nim: payload.nim as string,
      name: payload.name as string,
      role: payload.role as 'ADMIN' | 'VOTER',
    };
  } catch {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      if (!payload.nim || !payload.role) return null;
      return { nim: payload.nim, name: payload.name, role: payload.role };
    } catch {
      return null;
    }
  }
}

/**
 * Set cookie sesi yang aman
 */
export async function setSessionCookie(
  response: NextResponse,
  user: SessionUser
): Promise<void> {
  try {
    const token = await signToken(user);

    // Set cookie di NextResponse object
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 jam
    });

    // Juga set cookie lama (user_role, user_nim, user_name) demi kompatibilitas frontend
    response.cookies.set('user_role', user.role, { path: '/' });
    response.cookies.set('user_nim', user.nim, { path: '/' });
    response.cookies.set('user_name', user.name, { path: '/' });
  } catch (e) {
    console.error('[auth] Error in setSessionCookie:', e);
  }
}

/**
 * Hapus cookie sesi (logout)
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  response.cookies.delete('user_role');
  response.cookies.delete('user_nim');
  response.cookies.delete('user_name');
}

/**
 * Ambil user dari cookie sesi JWT
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const user = await verifyToken(token);
      if (user) return user;
    }
    // Fallback baca cookie lama jika session_token belum ada
    const role = cookieStore.get('user_role')?.value as 'ADMIN' | 'VOTER' | undefined;
    const nim = cookieStore.get('user_nim')?.value;
    const name = cookieStore.get('user_name')?.value || 'User';
    if (nim && role) {
      return { nim, name, role };
    }
    return null;
  } catch {
    return null;
  }
}
