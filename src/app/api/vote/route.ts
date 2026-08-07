import { NextResponse } from 'next/server';
import { db, writeAuditLog } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  // Ambil IP untuk audit log
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  try {
    // Ambil user dari JWT session (httpOnly cookie) — lebih aman dari cookie plain-text
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: 'Sesi login telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // Hanya VOTER yang boleh submit suara (bukan ADMIN)
    if (sessionUser.role !== 'VOTER') {
      return NextResponse.json(
        { message: 'Akses ditolak. Hanya pemilih terdaftar yang dapat memberikan suara.' },
        { status: 403 }
      );
    }

    const nim = sessionUser.nim;
    const { candidateId, candidateNumber, isAbstain } = await request.json();
    const targetCandidateNum = Number(candidateNumber || candidateId || 1);

    // 1. Coba simpan suara via Firestore terlebih dahulu
    try {
      const { collection, addDoc, doc, updateDoc, getDocs, query, where } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');

      const userQ = query(collection(fdb, 'users'), where('nim', '==', nim));
      const userSnap = await getDocs(userQ);

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();

        if (userData.hasVoted) {
          return NextResponse.json(
            { message: 'Hak pilih Anda telah tercatat sebelumnya.' },
            { status: 400 }
          );
        }

        // Simpan suara anonim ke Firestore
        await addDoc(collection(fdb, 'votes'), {
          candidateId: isAbstain ? null : targetCandidateNum,
          isValid: !isAbstain,
          createdAt: new Date().toISOString(),
        });

        // Kunci akun pemilih
        await updateDoc(doc(fdb, 'users', userDoc.id), {
          hasVoted: true,
          votedAt: new Date().toISOString(),
        });

        await writeAuditLog(
          'VOTE_CAST',
          nim,
          ip,
          isAbstain ? 'Pemilih memilih abstain' : `Suara untuk Paslon #${targetCandidateNum}`
        );

        return NextResponse.json({
          success: true,
          message: 'Suara Anda telah berhasil disimpan secara anonim ke Firestore.',
        });
      }
    } catch (fsErr) {
      console.error('[Firestore Vote POST Error]:', fsErr);
    }

    // 2. Fallback ke PostgreSQL
    const voter = await db.user.findUnique({
      where: { nim },
    });

    if (!voter) {
      return NextResponse.json(
        { message: 'Data pemilih tidak ditemukan di PostgreSQL.' },
        { status: 404 }
      );
    }

    if (voter.hasVoted) {
      return NextResponse.json(
        { message: 'Hak pilih Anda telah tercatat sebelumnya.' },
        { status: 400 }
      );
    }

    // 2. Transaksi Atomik: Simpan Suara Anonim & Lock Akun Pemilih
    await db.$transaction([
      // Simpan suara anonim dengan candidateId diisi Nomor Urut Paslon (1, 2, dst)
      db.vote.create({
        data: {
          candidateId: isAbstain ? null : targetCandidateNum,
          isValid: !isAbstain,
        },
      }),
      // Kunci akun pemilih agar tidak bisa memilih dua kali
      db.user.update({
        where: { nim },
        data: {
          hasVoted: true,
          votedAt: new Date(),
        },
      }),
    ]);

    // 3. Catat audit log pemungutan suara
    await writeAuditLog(
      'VOTE_CAST',
      nim,
      ip,
      isAbstain ? 'Pemilih memilih abstain' : `Suara untuk candidateId: ${candidateId}`
    );

    return NextResponse.json({
      success: true,
      message: 'Suara Anda telah berhasil disimpan secara anonim.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Gagal menyimpan suara ke PostgreSQL.' },
      { status: 500 }
    );
  }
}
