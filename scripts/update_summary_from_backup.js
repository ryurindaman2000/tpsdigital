const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAl1LGhawFhGOFFGksAI-3ymfkL2_quO98",
  authDomain: "jambulayam-517e1.firebaseapp.com",
  projectId: "jambulayam-517e1",
  storageBucket: "jambulayam-517e1.firebasestorage.app",
  messagingSenderId: "115351959450",
  appId: "1:115351959450:web:09bb24af4c747d2497ac23"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function updateSummaryFromBackup() {
  const backupPath = path.join(__dirname, '..', 'backups', 'backup-firestore-2026-08-12T02-19-41-602Z.json');
  if (!fs.existsSync(backupPath)) {
    console.error('File backup tidak ditemukan!');
    process.exit(1);
  }

  const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const users = backupContent.collections.users || [];
  const candidatesList = backupContent.collections.candidates || [];
  const votesList = backupContent.collections.votes || [];

  candidatesList.sort((a, b) => (Number(a.candidateNumber) || 0) - (Number(b.candidateNumber) || 0));

  const voters = users.filter(u => u.role === 'VOTER' || (!u.role && u.nim !== 'admin'));
  const totalVoters = voters.length;
  const hasVotedUserCount = voters.filter(u => u.hasVoted === true).length;

  const candidateVotesRaw = candidatesList.map(c => {
    const voteCount = votesList.filter(v =>
      v.isValid !== false &&
      (Number(v.candidateId) === Number(c.id) || Number(v.candidateId) === Number(c.candidateNumber))
    ).length;

    return {
      id: String(c.id),
      candidateNumber: Number(c.candidateNumber) || 1,
      chairmanName: c.chairmanName || c.name || `Paslon 0${c.candidateNumber}`,
      viceChairmanName: c.viceChairmanName || '',
      name: c.name || `Paslon 0${c.candidateNumber}`,
      chairmanPhoto: c.chairmanPhoto || c.photoUrl || null,
      viceChairmanPhoto: c.viceChairmanPhoto || null,
      photoUrl: c.photoUrl || c.chairmanPhoto || null,
      voteCount,
    };
  });

  const totalVotesInBox = candidateVotesRaw.reduce((acc, c) => acc + c.voteCount, 0);
  const hasVotedCount = Math.max(hasVotedUserCount, totalVotesInBox);
  const turnoutPercent = totalVoters > 0 ? `${Math.round((hasVotedCount / totalVoters) * 100)}%` : '0%';

  const candidateVotes = candidateVotesRaw.map(c => ({
    ...c,
    percentage: totalVotesInBox > 0 ? Math.round((c.voteCount / totalVotesInBox) * 100) : 0,
  }));

  const payload = {
    totalVoters,
    hasVotedCount,
    turnoutPercent,
    abstainCount: 0,
    candidatesCount: candidatesList.length,
    candidateVotesJson: JSON.stringify(candidateVotes),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'stats', 'summary'), payload, { merge: true });

  console.log('✅ [SUCCESS] Dokumen stats/summary BERHASIL DIPERBARUI dari data backup!');
  console.log('Total Voters   :', totalVoters);
  console.log('Suara Masuk    :', hasVotedCount);
  console.log('Turnout        :', turnoutPercent);
  console.log('Candidate Votes:', candidateVotes);

  process.exit(0);
}

updateSummaryFromBackup();
