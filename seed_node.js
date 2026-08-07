const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, addDoc, collection } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAQQWVYgTH5t88oLvxA-hq4V-8G_RFfwKE",
  authDomain: "tps-digital.firebaseapp.com",
  projectId: "tps-digital",
  storageBucket: "tps-digital.firebasestorage.app",
  messagingSenderId: "452321480801",
  appId: "1:452321480801:web:a4dba6a40edc74e6a25a20"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedAll() {
  console.log("🔥 Memulai Seeding Firestore via Firebase Web SDK...");

  try {
    // 1. Seed Collection 'users'
    console.log("📌 Seeding users...");
    const adminData = {
      nim: 'admin',
      name: 'Panitia Pemilihan (Admin)',
      randomPassword: 'admin',
      role: 'ADMIN',
      hasVoted: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', 'users'), adminData);
    await setDoc(doc(db, 'users', 'admin'), adminData);
    console.log("✅ Users [users] & [admin] seeded.");

    // 2. Seed Collection 'settings'
    console.log("📌 Seeding settings...");
    await setDoc(doc(db, 'settings', 'default'), {
      id: 'default',
      appName: 'TPS-DIGITAL',
      subTitle: 'Sistem E-Voting Terenkripsi & Transparan',
      logoUrl: '/images/default-logo.png',
      bannerUrl: '/images/default-banner.jpg',
      kopUrl: null,
      updatedAt: new Date().toISOString(),
    });
    console.log("✅ Settings [default] seeded.");

    // 3. Seed Collection 'candidates'
    console.log("📌 Seeding candidates...");
    await addDoc(collection(db, 'candidates'), {
      candidateNumber: 1,
      chairmanName: 'Ahmad Fauzi',
      viceChairmanName: 'Siti Rahma',
      name: 'Ahmad Fauzi & Siti Rahma',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Mewujudkan organisasi yang transparan, profesional, dan berintegritas.',
      mission: '1. Mengoptimalkan sistem digitalisasi.\n2. Mengedepankan aspirasi seluruh anggota.\n3. Membangun kolaborasi berkelanjutan.',
      createdAt: new Date().toISOString(),
    });

    await addDoc(collection(db, 'candidates'), {
      candidateNumber: 2,
      chairmanName: 'Budi Santoso',
      viceChairmanName: 'Dewi Lestari',
      name: 'Budi Santoso & Dewi Lestari',
      chairmanPhoto: '/images/default-logo.png',
      viceChairmanPhoto: '/images/default-logo.png',
      photoUrl: '/images/default-logo.png',
      vision: 'Inovasi tanpa batas untuk kemajuan dan kesejahteraan bersama.',
      mission: '1. Menyediakan layanan digital terpadu.\n2. Meningkatkan efisiensi kerja organisasi.\n3. Menjunjung tinggi asas keadilan.',
      createdAt: new Date().toISOString(),
    });
    console.log("✅ Candidates Paslon 01 & 02 seeded.");

    // 4. Seed Collection 'audit_logs'
    console.log("📌 Seeding audit_logs...");
    await addDoc(collection(db, 'audit_logs'), {
      action: 'INITIAL_SEED',
      actor: 'admin',
      ipAddress: '127.0.0.1',
      details: 'Initial seeding Firestore via SDK',
      createdAt: new Date().toISOString(),
    });
    console.log("✅ Audit log seeded.");

    console.log("\n🎉 SEEDING FIRESTORE VIA SDK BERHASIL!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error Seeding:", err);
    process.exit(1);
  }
}

seedAll();
