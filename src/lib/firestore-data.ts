import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';

let recalculateLock: Promise<any> | null = null;

export async function recalculateFirestoreSummary() {
  // Jika sedang ada proses kalkulasi yang berjalan, gunakan promise yang sama (Mencegah Stampede 700 Reads per Request!)
  if (recalculateLock) {
    return await recalculateLock;
  }

  recalculateLock = (async () => {
    try {
      // BACA HANYA KANDIDAT (Hanya 2-3 dokumen, BUKAN 628 users & votes!)
      const candSnap = await getDocs(collection(db, 'candidates'));

      const candidatesList: any[] = [];
      candSnap.forEach((d) => candidatesList.push({ id: d.id, ...d.data() }));
      candidatesList.sort((a: any, b: any) => (Number(a.candidateNumber) || 0) - (Number(b.candidateNumber) || 0));

      // Cek dokumen summary yang sudah ada untuk mengambil totalVoters & voteCount tanpa scan ulang
      const summaryRef = doc(db, 'stats', 'summary');
      const existingSummarySnap = await getDoc(summaryRef);
      let existingData = existingSummarySnap.exists() ? existingSummarySnap.data() : null;

      let existingVoteMap: Record<string, number> = {};
      if (existingData && existingData.candidateVotesJson) {
        try {
          const parsed = JSON.parse(existingData.candidateVotesJson);
          parsed.forEach((c: any) => {
            existingVoteMap[String(c.candidateNumber)] = Number(c.voteCount) || 0;
            existingVoteMap[String(c.id)] = Number(c.voteCount) || 0;
          });
        } catch { }
      }

      const totalVoters = existingData?.totalVoters ? Number(existingData.totalVoters) : 628;

      const candidateVotesRaw = candidatesList.map((c: any) => {
        const voteCount = existingVoteMap[String(c.candidateNumber)] || existingVoteMap[String(c.id)] || 0;
        return {
          id: String(c.id),
          candidateNumber: Number(c.candidateNumber) || 1,
          chairmanName: c.chairmanName || (c.name ? c.name.split('&')[0]?.trim() : '') || c.name || `Paslon 0${c.candidateNumber}`,
          viceChairmanName: c.viceChairmanName || (c.name && c.name.includes('&') ? c.name.split('&')[1]?.trim() : ''),
          name: c.name || `Paslon 0${c.candidateNumber}`,
          voteCount,
        };
      });

      const totalVotesInBox = candidateVotesRaw.reduce((acc: number, c: any) => acc + c.voteCount, 0);
      const hasVotedCount = Math.max(existingData?.hasVotedCount || 0, totalVotesInBox);
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

      await setDoc(summaryRef, summaryPayload, { merge: true });

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
    } finally {
      recalculateLock = null;
    }
  })();

  return await recalculateLock;
}

export async function getFirestoreStats() {
  try {
    const summaryRef = doc(db, 'stats', 'summary');
    const summarySnap = await getDoc(summaryRef);

    if (summarySnap.exists()) {
      const summaryDoc = summarySnap.data();
      if (summaryDoc && summaryDoc.candidateVotesJson) {
        try {
          const candidateVotesRaw = JSON.parse(summaryDoc.candidateVotesJson);
          const totalVoters = Number(summaryDoc.totalVoters) || 0;
          const hasVotedCount = Number(summaryDoc.hasVotedCount) || 0;

          if (totalVoters > 0) {
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
          }
        } catch (parseErr) {
          console.warn('[Parse candidateVotesJson error, recalculating]:', parseErr);
        }
      }
    }

    // Jika dokumen summary belum ada atau totalVoters masih 0, jalankan kalkulasi awal 1 kali
    return await recalculateFirestoreSummary();
  } catch (error) {
    console.error('[Firestore Stats Error]:', error);
    return null;
  }
}

export async function updateFirestoreSummaryOnVote(targetCandidateNum: number, isAbstain: boolean = false) {
  try {
    const summaryRef = doc(db, 'stats', 'summary');
    const summarySnap = await getDoc(summaryRef);
    let summaryDoc = summarySnap.exists() ? summarySnap.data() : null;

    if (!summaryDoc || !summaryDoc.candidateVotesJson || (Number(summaryDoc.totalVoters) || 0) === 0) {
      await recalculateFirestoreSummary();
      const newSnap = await getDoc(summaryRef);
      summaryDoc = newSnap.exists() ? newSnap.data() : null;
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

    await setDoc(summaryRef, updatedPayload, { merge: true });
  } catch (err) {
    console.error('[Update Firestore Summary On Vote Error]:', err);
  }
}
