import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CandidateModel {
  id: number;
  candidateNumber: number;
  name: string;
  photoUrl?: string | null;
  vision?: string | null;
  mission?: string | null;
}

// GET /api/live-count - Menghitung perolehan suara real-time dari PostgreSQL
export async function GET() {
  try {
    const totalVoters = await db.user.count({
      where: { role: 'VOTER' },
    });

    const totalVotesCast = await db.vote.count();

    const invalidVotes = await db.vote.count({
      where: { isValid: false },
    });

    const candidates = await db.candidate.findMany({
      orderBy: { candidateNumber: 'asc' },
    });

    const candidateResults = await Promise.all(
      candidates.map(async (c: CandidateModel) => {
        const votes = await db.vote.count({
          where: { candidateId: c.id, isValid: true },
        });

        const percentage =
          totalVotesCast > 0 ? Number(((votes / totalVotesCast) * 100).toFixed(2)) : 0;

        return {
          id: c.id,
          candidateNumber: c.candidateNumber,
          name: c.name,
          votes,
          percentage,
        };
      })
    );

    const turnoutPercentage =
      totalVoters > 0 ? Number(((totalVotesCast / totalVoters) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalVoters,
        totalVotesCast,
        turnoutPercentage,
        invalidVotes,
        candidates: candidateResults,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal kalkulasi data real-time.' },
      { status: 500 }
    );
  }
}
