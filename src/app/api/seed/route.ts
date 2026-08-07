import { NextResponse } from 'next/server';
import { setFsDoc, addFsDoc } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Seed Users (Admin)
    const adminData = {
      nim: 'admin',
      name: 'Panitia Pemilihan (Admin)',
      randomPassword: 'admin',
      role: 'ADMIN',
      hasVoted: false,
      createdAt: new Date().toISOString(),
    };
    await setFsDoc('users', 'admin', adminData);
    await setFsDoc('users', 'users', adminData);

    // 2. Seed Settings
    await setFsDoc('settings', 'default', {
      id: 'default',
      appName: 'TPS-DIGITAL',
      subTitle: 'Sistem E-Voting Terenkripsi & Transparan',
      logoUrl: '/images/default-logo.png',
      bannerUrl: '/images/default-banner.jpg',
      kopUrl: null,
      updatedAt: new Date().toISOString(),
    });

    // 3. Seed Candidates (Paslon 01 & 02)
    await addFsDoc('candidates', {
      candidateNumber: 1,
      chairmanName: 'Ahmad Fauzi',
      viceChairmanName: 'Siti Rahma',
      name: 'Ahmad Fauzi & Siti Rahma',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Mewujudkan organisasi yang transparan, profesional, dan berintegritas.',
      mission: '1. Mengoptimalkan sistem digitalisasi.\n2. Mengedepankan aspirasi seluruh anggota.\n3. Membangun kolaborasi berkelanjutan.',
      createdAt: new Date().toISOString(),
    });

    await addFsDoc('candidates', {
      candidateNumber: 2,
      chairmanName: 'Budi Santoso',
      viceChairmanName: 'Dewi Lestari',
      name: 'Budi Santoso & Dewi Lestari',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Inovasi tanpa batas untuk kemajuan dan kesejahteraan bersama.',
      mission: '1. Menyediakan layanan digital terpadu.\n2. Meningkatkan efisiensi kerja organisasi.\n3. Menjunjung tinggi asas keadilan.',
      createdAt: new Date().toISOString(),
    });

    // 4. Seed Audit Log
    await addFsDoc('audit_logs', {
      action: 'INITIAL_SEED',
      actor: 'admin',
      ipAddress: '127.0.0.1',
      details: 'Initial seeding Firestore selesai via API',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Seeding Firestore Berhasil! Koleksi users, settings, candidates, dan audit_logs telah terisi.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
