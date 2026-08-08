const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

const DB_IDS = ["(default)", "default", PROJECT_ID];

// Helper: Decode Firestore REST response fields to plain JS object
export function decodeFirestoreDoc(doc: any) {
  if (!doc || !doc.fields) return null;
  const id = doc.name ? doc.name.split('/').pop() : undefined;
  const fields = doc.fields;
  const res: any = { id };

  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    if ('stringValue' in valObj) res[key] = valObj.stringValue;
    else if ('booleanValue' in valObj) res[key] = valObj.booleanValue;
    else if ('integerValue' in valObj) res[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) res[key] = Number(valObj.doubleValue);
    else if ('timestampValue' in valObj) res[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) res[key] = null;
    else res[key] = Object.values(valObj)[0];
  }
  return res;
}

// Helper: Encode plain JS object to Firestore REST fields format
export function encodeFirestoreFields(data: Record<string, any>) {
  const fields: Record<string, any> = {};
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

// Helper multi-db fetch
async function fetchWithDbFallback(docPath: string, options?: RequestInit) {
  for (const dbId of DB_IDS) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${dbId}/documents/${docPath}?key=${API_KEY}`;
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status !== 404) return res; // return error if not 404 database missing
    } catch {
      // try next dbId
    }
  }
  const fallbackUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${API_KEY}`;
  return fetch(fallbackUrl, options);
}

// 1. Get Single Document
export async function getFsDoc(collectionName: string, docId: string) {
  try {
    const res = await fetchWithDbFallback(`${collectionName}/${docId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return decodeFirestoreDoc(json);
  } catch (err) {
    console.error(`[FsRest getDoc ${collectionName}/${docId} Error]:`, err);
    return null;
  }
}

// 2. Get All Documents in Collection
export async function getFsCollection(collectionName: string) {
  try {
    const res = await fetchWithDbFallback(`${collectionName}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.documents || !Array.isArray(json.documents)) return [];
    return json.documents.map(decodeFirestoreDoc).filter(Boolean);
  } catch (err) {
    console.error(`[FsRest getCollection ${collectionName} Error]:`, err);
    return [];
  }
}

// 3. Set / Patch Document for Firestore REST API v1 (Upsert Document)
export async function setFsDoc(collectionName: string, docId: string, data: Record<string, any>) {
  try {
    const payload = encodeFirestoreFields(data);
    const res = await fetchWithDbFallback(`${collectionName}/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[FsRest setDoc Error ${res.status}]:`, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[FsRest setDoc ${collectionName}/${docId} Error]:`, err);
    return false;
  }
}

// 4. Add Document with Auto ID
export async function addFsDoc(collectionName: string, data: Record<string, any>) {
  try {
    const payload = encodeFirestoreFields(data);
    const res = await fetchWithDbFallback(`${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return decodeFirestoreDoc(json);
  } catch (err) {
    console.error(`[FsRest addDoc ${collectionName} Error]:`, err);
    return null;
  }
}

// 5. Delete Document
export async function deleteFsDoc(collectionName: string, docId: string) {
  try {
    const res = await fetchWithDbFallback(`${collectionName}/${docId}`, {
      method: 'DELETE',
      cache: 'no-store',
    });
    return res.ok;
  } catch (err) {
    console.error(`[FsRest deleteDoc ${collectionName}/${docId} Error]:`, err);
    return false;
  }
}
