import { getFsCollection, getFsDoc, setFsDoc } from './firestore-rest';

export async function recalculateFirestoreSummary() {
  try {
    // 1. Fetch Users (Voters)
    const users = await getFsCollection('users');
    const voters = users.filter((u: any) => u.role === 'VOTER' || (!u.role && u.nim !== 'admin'));
    const totalVoters = voters.length;
    const hasVotedUserCount = voters.filter((u: any) => u.hasVoted === true).length;

    // 2. Fetch Candidates
    const candidatesList = await getFsCollection('candidates');
    candidatesList.sort((a: any, b: any) => (Number(a.candidateNumber) || 0) - (Number(b.candidateNumber) || 0));

    // 3. Fetch Votes
    const votesList = await getFsCollection('votes');

    // Calculate votes per candidate
    const candidateVotesRaw = candidatesList.map((c: any) => {
      const voteCount = votesList.filter(
        (v: any) =>
          (v.isValid !== false) &&
          (Number(v.candidateId) === Number(c.id) || Number(v.candidateId) === Number(c.candidateNumber))
      ).length;

      return {
        id: String(c.id),
        candidateNumber: Number(c.candidateNumber) || 1,
        chairmanName: c.chairmanName || (c.name ? c.name.split('&')[0]?.trim() : '') || c.name || `Paslon 0${c.candidateNumber}`,
        viceChairmanName: c.viceChairmanName || (c.name && c.name.includes('&') ? c.name.split('&')[1]?.trim() : ''),
        name: c.name || `Paslon 0${c.candidateNumber}`,
        chairmanPhoto: c.chairmanPhoto || c.photoUrl || null,
        viceChairmanPhoto: c.viceChairmanPhoto || null,
        photoUrl: c.photoUrl || c.chairmanPhoto || null,
        voteCount,
      };
    });

    const totalVotesInBox = candidateVotesRaw.reduce((acc: number, c: any) => acc + c.voteCount, 0);
    const hasVotedCount = Math.max(hasVotedUserCount, totalVotesInBox);
    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

    const candidateVotes = candidateVotesRaw.map((c: any) => ({
      ...c,
      percentage: totalVotesInBox > 0 ? Math.round((c.voteCount / totalVotesInBox) * 100) : 0,
    }));

    const summaryPayload = {
      totalVoters,
      hasVotedCount,
      turnoutPercent,
      abstainCount: 0,
      candidatesCount: candidatesList.length,
      candidateVotesJson: JSON.stringify(candidateVotes),
      updatedAt: new Date().toISOString(),
    };

    // Save summary document to Firestore (Collection: 'stats', Doc: 'summary')
    await setFsDoc('stats', 'summary', summaryPayload);

    return {
      totalVoters,
      hasVotedCount,
      turnoutPercent,
      abstainCount: 0,
      candidatesCount: candidatesList.length,
      candidateVotes,
    };
  } catch (error) {
    console.error('[Recalculate Firestore Summary Error]:', error);
    return null;
  }
}

export async function getFirestoreStats() {
  try {
    // Coba ambil dari dokumen 'stats/summary' (Hemat Kuota Reads: Cuma 1 Read!)
    const summaryDoc = await getFsDoc('stats', 'summary');

    if (summaryDoc && summaryDoc.candidateVotesJson) {
      try {
        const candidateVotesRaw = JSON.parse(summaryDoc.candidateVotesJson);
        const totalVoters = Number(summaryDoc.totalVoters) || 0;
        const hasVotedCount = Number(summaryDoc.hasVotedCount) || 0;

        const totalVotesInBox = candidateVotesRaw.reduce((acc: number, c: any) => acc + (Number(c.voteCount) || 0), 0);
        const finalVotedCount = Math.max(hasVotedCount, totalVotesInBox);
        const turnoutPercent = totalVoters > 0 ? `${Math.round((finalVotedCount / totalVoters) * 100)}%` : '0%';

        const candidateVotes = candidateVotesRaw.map((c: any) => ({
          ...c,
          candidateNumber: Number(c.candidateNumber) || 1,
          voteCount: Number(c.voteCount) || 0,
          percentage: totalVotesInBox > 0 ? Math.round(((Number(c.voteCount) || 0) / totalVotesInBox) * 100) : 0,
        }));

        return {
          totalVoters,
          hasVotedCount: finalVotedCount,
          turnoutPercent,
          abstainCount: 0,
          candidatesCount: Number(summaryDoc.candidatesCount) || candidateVotes.length,
          candidateVotes,
        };
      } catch (parseErr) {
        console.warn('[Parse candidateVotesJson error, recalculating]:', parseErr);
      }
    }

    // Jika belum ada dokumen summary atau error parse, hitung awal & simpan summary
    return await recalculateFirestoreSummary();
  } catch (error) {
    console.error('[Firestore Stats Error]:', error);
    return null;
  }
}

export async function updateFirestoreSummaryOnVote(targetCandidateNum: number, isAbstain: boolean = false) {
  try {
    let summaryDoc = await getFsDoc('stats', 'summary');
    if (!summaryDoc || !summaryDoc.candidateVotesJson) {
      await recalculateFirestoreSummary();
      summaryDoc = await getFsDoc('stats', 'summary');
    }

    if (!summaryDoc || !summaryDoc.candidateVotesJson) return;

    let candidateVotesRaw: any[] = [];
    try {
      candidateVotesRaw = JSON.parse(summaryDoc.candidateVotesJson);
    } catch {
      candidateVotesRaw = [];
    }

    let hasVotedCount = (Number(summaryDoc.hasVotedCount) || 0) + 1;
    let totalVoters = Number(summaryDoc.totalVoters) || 0;

    if (!isAbstain) {
      let found = false;
      candidateVotesRaw = candidateVotesRaw.map((c: any) => {
        if (Number(c.candidateNumber) === Number(targetCandidateNum) || String(c.id) === String(targetCandidateNum)) {
          found = true;
          return { ...c, voteCount: (Number(c.voteCount) || 0) + 1 };
        }
        return c;
      });

      // Jika paslon belum ada di array summary, tambahkan
      if (!found) {
        candidateVotesRaw.push({
          id: String(targetCandidateNum),
          candidateNumber: Number(targetCandidateNum),
          chairmanName: `Paslon 0${targetCandidateNum}`,
          name: `Paslon 0${targetCandidateNum}`,
          voteCount: 1,
        });
      }
    }

    const totalVotesInBox = candidateVotesRaw.reduce((acc: number, c: any) => acc + (Number(c.voteCount) || 0), 0);
    const finalVotedCount = Math.max(hasVotedCount, totalVotesInBox);
    const turnoutPercent = totalVoters > 0 ? `${Math.round((finalVotedCount / totalVoters) * 100)}%` : '0%';

    const updatedPayload = {
      totalVoters,
      hasVotedCount: finalVotedCount,
      turnoutPercent,
      abstainCount: 0,
      candidatesCount: candidateVotesRaw.length,
      candidateVotesJson: JSON.stringify(candidateVotesRaw),
      updatedAt: new Date().toISOString(),
    };

    await setFsDoc('stats', 'summary', updatedPayload);
  } catch (err) {
    console.error('[Update Firestore Summary On Vote Error]:', err);
  }
}
