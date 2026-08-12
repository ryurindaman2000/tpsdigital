// Script Import / Seed Data dari Backup JSON ke Firebase Project (tumblerosca)
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAvMNYA8nM-y3ymyvfSEyQn8TU-lbcAOhQ",
  authDomain: "tumblerosca.firebaseapp.com",
  projectId: "tumblerosca",
  storageBucket: "tumblerosca.firebasestorage.app",
  messagingSenderId: "437887562003",
  appId: "1:437887562003:web:1ff95b649c4f2bf34f2ae6",
  measurementId: "G-64HMBSVQCF"
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
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ [ERROR] Folder backups tidak ditemukan di: ${backupDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error(`❌ [ERROR] Tidak ada file backup JSON di folder: ${backupDir}`);
    process.exit(1);
  }

  // Pilih file backup paling terbaru
  files.sort().reverse();
  const latestBackupFile = path.join(backupDir, files[0]);

  console.log(`[INFO] Membaca file backup terbaru: ${files[0]}...`);
  const backupJson = JSON.parse(fs.readFileSync(latestBackupFile, 'utf-8'));
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
  console.log(`🎉 SEEDING BERHASIL! Seluruh data backup telah di-import ke Firebase '${firebaseConfig.projectId}'.`);
  console.log("--------------------------------------------------");
  process.exit(0);
}

restoreData().catch((err) => {
  console.error("\n❌ [ERROR] Gagal melakukan restore:", err.message);
  process.exit(1);
});
