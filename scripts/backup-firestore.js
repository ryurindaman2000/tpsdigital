// Script Backup Firestore (Otomatis ke JSON via Firebase SDK)
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCEPPyx-quwp_uNBKrmrZCNo2vTkB7T5iQ",
  authDomain: "magnumfilter900.firebaseapp.com",
  projectId: "magnumfilter900",
  storageBucket: "magnumfilter900.firebasestorage.app",
  messagingSenderId: "476699516226",
  appId: "1:476699516226:web:dd536a96b520b58e563cdb"
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
