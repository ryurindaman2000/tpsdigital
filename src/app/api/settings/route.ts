import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const defaultSetting = {
  id: 'default',
  appName: 'TPS-DIGITAL',
  subTitle: 'Sistem E-Voting Terenkripsi & Transparan',
  logoUrl: '/images/default-logo.png' as string | null,
  bannerUrl: '/images/default-banner.jpg' as string | null,
  kopUrl: null as string | null,
};

// GET /api/settings - Ambil nama aplikasi, logo, banner, dan kop surat (Firestore / PostgreSQL)
export async function GET() {
  try {
    // 1. Coba ambil dari Firestore terlebih dahulu
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');
      const docSnap = await getDoc(doc(fdb, 'settings', 'default'));
      if (docSnap.exists()) {
        const s = docSnap.data();
        return NextResponse.json({
          success: true,
          data: {
            id: 'default',
            appName: s.appName || defaultSetting.appName,
            subTitle: s.subTitle || defaultSetting.subTitle,
            logoUrl: s.logoUrl || defaultSetting.logoUrl,
            bannerUrl: s.bannerUrl || defaultSetting.bannerUrl,
            kopUrl: s.kopUrl || null,
          },
        });
      }
    } catch (fsErr) {
      console.error('[Firestore Settings GET Error]:', fsErr);
    }

    // 2. Fallback ke PostgreSQL
    const setting = await db.setting.findUnique({
      where: { id: 'default' },
    });

    if (setting) {
      return NextResponse.json({
        success: true,
        data: {
          id: setting.id,
          appName: setting.appName || defaultSetting.appName,
          subTitle: setting.subTitle || defaultSetting.subTitle,
          logoUrl: setting.logoUrl || defaultSetting.logoUrl,
          bannerUrl: setting.bannerUrl || defaultSetting.bannerUrl,
          kopUrl: (setting as any).kopUrl || null,
        },
      });
    }

    return NextResponse.json({ success: true, data: defaultSetting });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: defaultSetting });
  }
}

// POST /api/settings - Update nama aplikasi, logo, banner, dan kop surat di Supabase PostgreSQL
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appName, subTitle, logoUrl, bannerUrl, kopUrl } = body;

    if (!appName || !appName.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama aplikasi wajib diisi.' },
        { status: 400 }
      );
    }

    const newAppName = String(appName).trim();
    const newSubTitle = subTitle ? String(subTitle).trim() : 'Sistem E-Voting Terenkripsi & Transparan';
    const newLogoUrl = logoUrl || '/images/default-logo.png';
    const newBannerUrl = bannerUrl || '/images/default-banner.jpg';
    const newKopUrl = kopUrl || null;

    // 1. Simpan ke Firestore
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');
      await setDoc(doc(fdb, 'settings', 'default'), {
        id: 'default',
        appName: newAppName,
        subTitle: newSubTitle,
        logoUrl: newLogoUrl,
        bannerUrl: newBannerUrl,
        kopUrl: newKopUrl,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fsErr) {
      console.error('[Firestore Settings POST Error]:', fsErr);
    }

    // 2. Simpan ke PostgreSQL
    const updatedSetting = await (db.setting as any).upsert({
      where: { id: 'default' },
      update: {
        appName: newAppName,
        subTitle: newSubTitle,
        logoUrl: newLogoUrl,
        bannerUrl: newBannerUrl,
        kopUrl: newKopUrl,
      },
      create: {
        id: 'default',
        appName: newAppName,
        subTitle: newSubTitle,
        logoUrl: newLogoUrl,
        bannerUrl: newBannerUrl,
        kopUrl: newKopUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pengaturan nama, logo, banner, dan kop surat aplikasi berhasil diperbarui di database!',
      data: updatedSetting,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui pengaturan aplikasi.' },
      { status: 500 }
    );
  }
}
