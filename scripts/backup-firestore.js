// Script Backup Firestore (Otomatis ke JSON via Firebase SDK)
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAl1LGhawFhGOFFGksAI-3ymfkL2_quO98",
  authDomain: "jambulayam-517e1.firebaseapp.com",
  projectId: "jambulayam-517e1",
  storageBucket: "jambulayam-517e1.firebasestorage.app",
  messagingSenderId: "115351959450",
  appId: "1:115351959450:web:09bb24af4c747d2497ac23"
};

const app = initializeApp(firebaseConfig);
// Menggunakan databaseId 'default' sesuai database aktif di Firebase Console
const db = getFirestore(app, 'default');

const COLLECTIONS = ["users", "candidates", "votes", "settings", "stats"];

async function runBackup() {
  console.log(`[INFO] Memulai Backup Firestore Project '${firebaseConfig.projectId}' (DB: default)...`);
  const backupData = {
    projectId: firebaseConfig.projectId,
    databaseId: 'default',
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

  const filename = `backup-firestore-${nowStr}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log("\n--------------------------------------------------");
  console.log(`🎉 BACKUP SUKSES TERSIMPAN!`);
  console.log(`File: ${filePath}`);
  console.log("--------------------------------------------------");

  process.exit(0);
}

runBackup();
