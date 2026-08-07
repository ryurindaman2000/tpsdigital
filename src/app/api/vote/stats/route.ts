import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Jalankan semua query database secara PARALEL untuk kecepatan maksimal
    const [totalVoters, hasVotedCount, abstainCount, candidates, totalValidVotes] = await Promise.all([
      db.user.count({ where: { role: 'VOTER' } }),
      db.user.count({ where: { role: 'VOTER', hasVoted: true } }),
      db.vote.count({ where: { isValid: false } }),
      db.candidate.findMany({
        orderBy: { candidateNumber: 'asc' },
      }),
      db.vote.count({ where: { isValid: true } }),
    ]);

    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

    // Hitung perolehan suara tiap paslon secara paralel
    const candidateVotes = await Promise.all(
      candidates.map(async (c: any) => {
        const voteCount = await db.vote.count({
          where: { candidateId: c.id, isValid: true },
        });

        const percentage = totalValidVotes > 0 ? Math.round((voteCount / totalValidVotes) * 100) : 0;

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
          percentage,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalVoters,
        hasVotedCount,
        turnoutPercent,
        abstainCount,
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
