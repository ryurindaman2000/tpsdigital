import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getFirestoreStats() {
  try {
    // 1. Fetch Users (Voters)
    const usersRef = collection(db, 'users');
    let votersSnap;
    try {
      votersSnap = await getDocs(query(usersRef, where('role', '==', 'VOTER')));
    } catch {
      votersSnap = await getDocs(usersRef);
    }

    const totalVoters = votersSnap.docs.filter((doc) => doc.data().role === 'VOTER').length;
    const hasVotedUserCount = votersSnap.docs.filter((doc) => doc.data().role === 'VOTER' && doc.data().hasVoted === true).length;

    // 2. Fetch Candidates
    const candidatesRef = collection(db, 'candidates');
    const candidatesSnap = await getDocs(candidatesRef);
    
    let candidatesList: any[] = [];
    if (!candidatesSnap.empty) {
      candidatesSnap.forEach((docSnap) => {
        candidatesList.push({ id: docSnap.id, ...docSnap.data() });
      });
    }
    candidatesList.sort((a, b) => (Number(a.candidateNumber) || 0) - (Number(b.candidateNumber) || 0));

    // 3. Fetch Votes
    const votesRef = collection(db, 'votes');
    const votesSnap = await getDocs(votesRef);
    
    let votesList: any[] = [];
    if (!votesSnap.empty) {
      votesSnap.forEach((docSnap) => {
        const v = docSnap.data();
        if (v.isValid !== false) {
          votesList.push(v);
        }
      });
    }

    // Calculate votes per candidate
    const candidateVotesRaw = candidatesList.map((c: any) => {
      const voteCount = votesList.filter(
        (v: any) =>
          Number(v.candidateId) === Number(c.id) ||
          Number(v.candidateId) === Number(c.candidateNumber)
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

    const totalVotesInBox = candidateVotesRaw.reduce((acc, c) => acc + c.voteCount, 0);
    const hasVotedCount = Math.max(hasVotedUserCount, totalVotesInBox);
    const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

    const candidateVotes = candidateVotesRaw.map((c) => ({
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
