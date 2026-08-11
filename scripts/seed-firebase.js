// Script Node.js Seeding Firestore Firebase Baru
const https = require('https');

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAl1LGhawFhGOFFGksAI-3ymfkL2_quO98",
  authDomain: "jambulayam-517e1.firebaseapp.com",
  projectId: "jambulayam-517e1",
  storageBucket: "jambulayam-517e1.firebasestorage.app",
  messagingSenderId: "115351959450",
  appId: "1:115351959450:web:09bb24af4c747d2497ac23"
};

const PROJECT_ID = FIREBASE_CONFIG.projectId;
const API_KEY = FIREBASE_CONFIG.apiKey;
const HOST = "firestore.googleapis.com";

// 1. Data Admin User
const adminData = {
  fields: {
    nim: { stringValue: "admin" },
    name: { stringValue: "Panitia Pemilihan (Admin)" },
    role: { stringValue: "ADMIN" },
    randomPassword: { stringValue: "admin" },
    password: { stringValue: "admin" },
    hasVoted: { booleanValue: false },
    createdAt: { stringValue: new Date().toISOString() }
  }
};

// 2. Data Settings Default
const settingsData = {
  fields: {
    id: { stringValue: "default" },
    appName: { stringValue: "TPS-DIGITAL" },
    subTitle: { stringValue: "Sistem E-Voting Terenkripsi & Transparan" },
    logoUrl: { stringValue: "/images/default-logo.png" },
    bannerUrl: { stringValue: "/images/default-banner.jpg" },
    updatedAt: { stringValue: new Date().toISOString() }
  }
};

function sendRestRequest(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: HOST,
      port: 443,
      path: `${path}?key=${API_KEY}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function runSeed() {
  console.log(`[INFO] Memulai Seeding Firestore Project Node.js: '${PROJECT_ID}'...`);
  try {
    // Seed Admin Document
    await sendRestRequest(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/admin`, adminData);
    console.log("✅ [SUCCESS] Akun Admin (users/admin) Berhasil Di-seed!");

    // Seed Settings Document
    await sendRestRequest(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/default`, settingsData);
    console.log("✅ [SUCCESS] Pengaturan Aplikasi (settings/default) Berhasil Di-seed!");

    console.log("\n----------------------------------------");
    printInfo();
  } catch (error) {
    console.error("\n❌ [ERROR] Gagal Seeding Firestore:", error.message);
  }
}

function printInfo() {
  console.log("🎉 SEEDING BERHASIL PENUH SELESAI!");
  console.log("Project ID :", PROJECT_ID);
  console.log("Username   : admin");
  console.log("Password   : admin");
  console.log("Role       : ADMIN");
  console.log("----------------------------------------");
}

runSeed();
