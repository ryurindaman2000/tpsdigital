// Script Import / Seed Data dari Backup JSON ke Firebase Project Baru (magnumfilter900)
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCEPPyx-quwp_uNBKrmrZCNo2vTkB7T5iQ",
  authDomain: "magnumfilter900.firebaseapp.com",
  projectId: "magnumfilter900",
  storageBucket: "magnumfilter900.firebasestorage.app",
  messagingSenderId: "476699516226",
  appId: "1:476699516226:web:dd536a96b520b58e563cdb"
};

const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore DB
let db;
try {
  db = getFirestore(app, 'default');
} catch {
  db = getFirestore(app);
}

async function restoreData() {
  const backupFile = path.join(__dirname, '..', 'backups', 'backup-firestore-2026-08-12T02-19-41-602Z.json');
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ [ERROR] File backup tidak ditemukan di: ${backupFile}`);
    process.exit(1);
  }

  console.log(`[INFO] Membaca file backup: ${path.basename(backupFile)}...`);
  const backupJson = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
  const collections = backupJson.collections || {};

  console.log(`[INFO] Memulai Seeding ke Firebase Project: '${firebaseConfig.projectId}'...`);

  for (const colName of Object.keys(collections)) {
    const docs = collections[colName] || [];
    console.log(`\nImporting collection '${colName}' (${docs.length} dokumen)...`);

    if (docs.length === 0) continue;

    // Firestore writeBatch maksimal 500 dokumen per batch
    const chunkSize = 400;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      let batch = writeBatch(db);

      for (const item of chunk) {
        const { id, ...data } = item;
        const docId = String(id || `doc_${Math.random().toString(36).substring(2, 9)}`);
        const docRef = doc(db, colName, docId);
        batch.set(docRef, data, { merge: true });
      }

      await batch.commit();
      console.log(`  ✅ Successfully committed batch ${Math.floor(i / chunkSize) + 1} (${chunk.length} docs)`);
    }
  }

  console.log("\n--------------------------------------------------");
  console.log(`🎉 SEEDING BERHASIL! Seluruh data backup telah di-import ke Firebase 'magnumfilter900'.`);
  console.log("--------------------------------------------------");
  process.exit(0);
}

restoreData().catch((err) => {
  console.error("\n❌ [ERROR] Gagal melakukan restore:", err.message);
  process.exit(1);
});
