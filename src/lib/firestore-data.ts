import { getFsCollection } from './firestore-rest';

export async function getFirestoreStats() {
  try {
    // 1. Fetch Users (Voters)
    const users = await getFsCollection('users');
    const voters = users.filter((u: any) => u.role === 'VOTER');
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
        id: c.id,
        candidateNumber: c.candidateNumber || 1,
        chairmanName: c.chairmanName || (c.name ? c.name.split('&')[0]?.trim() : '') || c.name || `Paslon 0${c.candidateNumber}`,
        viceChairmanName: c.viceChairmanName || (c.name && c.name.includes('&') ? c.name.split('&')[1]?.trim() : ''),
        name: c.name || `Paslon 0${c.candidateNumber}`,
        chairmanPhoto: c.chairmanPhoto || c.photoUrl,
        viceChairmanPhoto: c.viceChairmanPhoto,
        photoUrl: c.photoUrl || c.chairmanPhoto,
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

    return {
      totalVoters,
      hasVotedCount,
      turnoutPercent,
      abstainCount: 0,
      candidatesCount: candidatesList.length,
      candidateVotes,
    };
  } catch (error) {
    console.error('[Firestore Stats Error]:', error);
    return null;
  }
}
