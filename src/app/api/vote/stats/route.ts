import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // 1. Hitung statistik pemilih
    const totalVoters = await db.user.count({ where: { role: 'VOTER' } });
    const hasVotedCount = await db.user.count({ where: { role: 'VOTER', hasVoted: true } });
    const abstainCount = await db.vote.count({ where: { isValid: false } });
    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

    // 2. Ambil daftar paslon
    const candidates = await db.candidate.findMany({
      orderBy: { candidateNumber: 'asc' },
    });

    const totalValidVotes = await db.vote.count({ where: { isValid: true } });

    // 3. Hitung perolehan suara tiap paslon
    const candidateVotes = await Promise.all(
      candidates.map(async (c: any) => {
        const voteCount = await db.vote.count({
          where: { candidateId: c.id, isValid: true },
        });

        const percentage = totalValidVotes > 0 ? Math.round((voteCount / totalValidVotes) * 100) : 0;

        return {
          id: c.id,
          candidateNumber: c.candidateNumber,
          chairmanName: c.chairmanName || c.name.split('&')[0]?.trim() || c.name,
          viceChairmanName: c.viceChairmanName || c.name.split('&')[1]?.trim() || '',
          name: c.name,
          chairmanPhoto: c.chairmanPhoto,
          viceChairmanPhoto: c.viceChairmanPhoto,
          photoUrl: c.photoUrl,
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
