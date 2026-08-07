import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFirestoreStats } from '@/lib/firestore-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Coba ambil statistik data langsung dari Firestore terlebih dahulu
    const firestoreStats = await getFirestoreStats();
    if (firestoreStats && (firestoreStats.totalVoters > 0 || firestoreStats.candidatesCount > 0)) {
      return NextResponse.json({
        success: true,
        data: firestoreStats,
      });
    }

    // 2. Fallback ke Prisma PostgreSQL jika Firestore kosong
    const [totalVoters, hasVotedUserCount, candidates, totalValidVotes] = await Promise.all([
      db.user.count({ where: { role: 'VOTER' } }),
      db.user.count({ where: { role: 'VOTER', hasVoted: true } }),
      db.candidate.findMany({
        orderBy: { candidateNumber: 'asc' },
      }),
      db.vote.count({ where: { isValid: true } }),
    ]);

    // Ambil seluruh vote sah dari database
    const allVotes = await db.vote.findMany({
      where: { isValid: true },
      select: { candidateId: true },
    });

    // Hitung perolehan suara tiap paslon murni BERDASARKAN CANDIDATE NUMBER ATAU ID (dengan konversi Number presisi)
    const candidateVotesRaw = candidates.map((c: any) => {
      // Hitung suara yang cocok dengan ID Kandidat atau candidateNumber (1, 2, dst)
      const voteCount = allVotes.filter(
        (v: any) =>
          Number(v.candidateId) === Number(c.id) ||
          Number(v.candidateId) === Number(c.candidateNumber)
      ).length;

      return {
        id: c.id,
        candidateNumber: c.candidateNumber,
        chairmanName: c.chairmanName || (c.name ? c.name.split('&')[0]?.trim() : '') || c.name || `Paslon 0${c.candidateNumber}`,
        viceChairmanName: c.viceChairmanName || (c.name && c.name.includes('&') ? c.name.split('&')[1]?.trim() : ''),
        name: c.name || `Paslon 0${c.candidateNumber}`,
        chairmanPhoto: c.chairmanPhoto || c.photoUrl,
        viceChairmanPhoto: c.viceChairmanPhoto,
        photoUrl: c.photoUrl || c.chairmanPhoto,
        voteCount,
      };
    });

    // Hitung total suara fisik sah yang diterima semua paslon
    const totalVotesInBox = candidateVotesRaw.reduce((acc, c) => acc + c.voteCount, 0);

    // Gunakan total suara terbesar antara user.hasVoted dan vote record
    const hasVotedCount = Math.max(hasVotedUserCount, totalVotesInBox);
    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

    // Sertakan persentase yang sudah presisi
    const candidateVotes = candidateVotesRaw.map((c) => ({
      ...c,
      percentage: totalVotesInBox > 0 ? Math.round((c.voteCount / totalVotesInBox) * 100) : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalVoters,
        hasVotedCount,
        turnoutPercent,
        abstainCount: 0,
        candidatesCount: candidates.length,
        candidateVotes,
      },
    });
  } catch (error: any) {
    console.error('Error fetching vote stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal mengambil statistik perolehan suara.',
        data: {
          totalVoters: 0,
          hasVotedCount: 0,
          turnoutPercent: '0%',
          abstainCount: 0,
          candidatesCount: 0,
          candidateVotes: [],
        },
      },
      { status: 500 }
    );
  }
}
