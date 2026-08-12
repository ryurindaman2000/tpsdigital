// Script Backup Firestore (Otomatis ke JSON via Firebase SDK)
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

let db;
try {
  db = getFirestore(app, 'default');
} catch {
  db = getFirestore(app);
}

const COLLECTIONS = ["users", "candidates", "votes", "settings", "stats"];

async function runBackup() {
  console.log(`[INFO] Memulai Backup Firestore Project '${firebaseConfig.projectId}'...`);
  const backupData = {
    projectId: firebaseConfig.projectId,
    backupTime: new Date().toISOString(),
    collections: {},
  };

  for (const colName of COLLECTIONS) {
    try {
      process.stdout.write(`Fetching collection '${colName}'... `);
      const snap = await getDocs(collection(db, colName));
      const docs = [];
      snap.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      backupData.collections[colName] = docs;
      console.log(`✅ (${docs.length} dokumen)`);
    } catch (err) {
      console.log(`❌ (Error: ${err.message})`);
      backupData.collections[colName] = [];
    }
  }

  const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `backup-${firebaseConfig.projectId}-${nowStr}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log("\n--------------------------------------------------");
  console.log(`🎉 BACKUP SUKSES TERSIMPAN!`);
  console.log(`File: ${filePath}`);
  console.log("--------------------------------------------------");

  process.exit(0);
}

runBackup();
