import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFirestoreStats } from '@/lib/firestore-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let statsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000; // Cache 5 detik

export async function GET() {
  try {
    if (statsCache && Date.now() - statsCache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: statsCache.data,
      });
    }

    // 1. Coba ambil statistik data langsung dari Firestore terlebih dahulu
    const firestoreStats = await getFirestoreStats();
    if (firestoreStats) {
      statsCache = { data: firestoreStats, timestamp: Date.now() };
      return NextResponse.json({
        success: true,
        data: firestoreStats,
      });
    }

    // 2. Fallback aman ke Prisma PostgreSQL (Abaikan jika Supabase error / limit exceeded)
    let totalVoters = 0;
    let hasVotedUserCount = 0;
    let candidates: any[] = [];
    let allVotes: any[] = [];

    try {
      if (db.user && db.candidate && db.vote) {
        [totalVoters, hasVotedUserCount, candidates, allVotes] = await Promise.all([
          db.user.count({ where: { role: 'VOTER' } }),
          db.user.count({ where: { role: 'VOTER', hasVoted: true } }),
          db.candidate.findMany({ orderBy: { candidateNumber: 'asc' } }),
          db.vote.findMany({ where: { isValid: true }, select: { candidateId: true } }),
        ]);
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Stats Fallback Ignored]:', pgErr);
    }

    const candidateVotesRaw = candidates.map((c: any) => {
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

    const totalVotesInBox = candidateVotesRaw.reduce((acc, c) => acc + c.voteCount, 0);
    const hasVotedCount = Math.max(hasVotedUserCount, totalVotesInBox);
    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

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
    return NextResponse.json({
      success: true,
      data: {
        totalVoters: 0,
        hasVotedCount: 0,
        turnoutPercent: '0%',
        abstainCount: 0,
        candidatesCount: 0,
        candidateVotes: [],
      },
    });
  }
}
