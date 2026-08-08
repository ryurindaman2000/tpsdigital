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
    const resUsers1 = await setFsDoc('users', 'admin', adminData);
    const resUsers2 = await setFsDoc('users', 'users', adminData);

    // 2. Seed Settings
    const resSettings = await setFsDoc('settings', 'default', {
      id: 'default',
      appName: 'TPS-DIGITAL',
      subTitle: 'Sistem E-Voting Terenkripsi & Transparan',
      logoUrl: '/images/default-logo.png',
      bannerUrl: '/images/default-banner.jpg',
      kopUrl: null,
      updatedAt: new Date().toISOString(),
    });

    // 3. Seed Candidates (Paslon 01 & 02)
    const resC1 = await addFsDoc('candidates', {
      candidateNumber: 1,
      chairmanName: 'Ahmad Fauzi',
      viceChairmanName: 'Siti Rahma',
      name: 'Ahmad Fauzi & Siti Rahma',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Mewujudkan organisasi yang transparan, profesional, dan berintegritas.',
      mission: '1. Mengoptimalkan sistem digitalisasi.\n2. Mengedepankan aspirasi seluruh anggota.',
      createdAt: new Date().toISOString(),
    });

    const resC2 = await addFsDoc('candidates', {
      candidateNumber: 2,
      chairmanName: 'Budi Santoso',
      viceChairmanName: 'Dewi Lestari',
      name: 'Budi Santoso & Dewi Lestari',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Inovasi tanpa batas untuk kemajuan dan kesejahteraan bersama.',
      mission: '1. Menyediakan layanan digital terpadu.\n2. Meningkatkan efisiensi kerja.',
      createdAt: new Date().toISOString(),
    });

    if (!resUsers1 || !resSettings || !resC1) {
      return NextResponse.json({
        success: false,
        message: 'Gagal menulis ke Firestore. Pastikan Firestore Database (default) sudah diaktifkan di Firebase Console.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Seeding Firestore Berhasil! Koleksi users, settings, dan candidates telah terisi.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
