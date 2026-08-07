const PROJECT_ID = "tps-digital";
const API_KEY = "AIzaSyAQQWVYgTH5t88oLvxA-hq4V-8G_RFfwKE";
const DB_IDS = ["(default)", "default", PROJECT_ID];

function encodeFields(data) {
  const fields = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      fields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    } else {
      fields[key] = { stringValue: String(val) };
    }
  }
  return { fields };
}

async function fetchWithDbFallback(docPath, options) {
  for (const dbId of DB_IDS) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${dbId}/documents/${docPath}?key=${API_KEY}`;
    try {
      const res = await fetch(url, options);
      if (res.ok) return { res, dbId };
    } catch {}
  }
  const fallbackUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${API_KEY}`;
  const res = await fetch(fallbackUrl, options);
  return { res, dbId: '(default)' };
}

async function setDoc(collection, docId, data) {
  const { res, dbId } = await fetchWithDbFallback(`${collection}/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeFields(data)),
  });
  if (!res.ok) {
    console.error(`[Error ${res.status}] ${collection}/${docId}:`, await res.text());
  } else {
    console.log(`✅ [Berhasil via ${dbId}] ${collection}/${docId}`);
  }
}

async function addDoc(collection, data) {
  const { res, dbId } = await fetchWithDbFallback(`${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeFields(data)),
  });
  if (!res.ok) {
    console.error(`[Error ${res.status}] ${collection}:`, await res.text());
  } else {
    const json = await res.json();
    const newId = json.name ? json.name.split('/').pop() : 'auto';
    console.log(`✅ [Berhasil Tambah via ${dbId}] ${collection}/${newId}`);
  }
}

async function seedAll() {
  console.log("🔥 Memulai Seeding Firestore sesuai Skema Supabase (Multi-Database Fallback)...\n");

  // 1. Seed Users (Admin & Sample Voter)
  console.log("📌 1. Seeding Collection 'users'...");
  await setDoc('users', 'admin', {
    nim: 'admin',
    name: 'Panitia Pemilihan (Admin)',
    randomPassword: 'admin',
    role: 'ADMIN',
    hasVoted: false,
    createdAt: new Date().toISOString(),
  });

  await setDoc('users', 'users', {
    nim: 'admin',
    name: 'Panitia Pemilihan (Admin)',
    randomPassword: 'admin',
    role: 'ADMIN',
    hasVoted: false,
    createdAt: new Date().toISOString(),
  });

  // 2. Seed Settings
  console.log("\n📌 2. Seeding Collection 'settings'...");
  await setDoc('settings', 'default', {
    id: 'default',
    appName: 'TPS-DIGITAL',
    subTitle: 'Sistem E-Voting Terenkripsi & Transparan',
    logoUrl: '/images/default-logo.png',
    bannerUrl: '/images/default-banner.jpg',
    kopUrl: null,
    updatedAt: new Date().toISOString(),
  });

  // 3. Seed Candidates (Paslon 01 & Paslon 02)
  console.log("\n📌 3. Seeding Collection 'candidates'...");
  await addDoc('candidates', {
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

  await addDoc('candidates', {
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

  // 4. Seed Audit Log
  console.log("\n📌 4. Seeding Collection 'audit_logs'...");
  await addDoc('audit_logs', {
    action: 'INITIAL_SEED',
    actor: 'admin',
    ipAddress: '127.0.0.1',
    details: 'Initial seeding Firestore selesai sesuai skema Supabase',
    createdAt: new Date().toISOString(),
  });

  console.log("\n🎉 SEEDING FIRESTORE BERHASIL! Semua koleksi telah terisi sempurna.");
}

seedAll();
