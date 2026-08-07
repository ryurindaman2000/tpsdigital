import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAQQWVYgTH5t88oLvxA-hq4V-8G_RFfwKE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tps-digital.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tps-digital",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tps-digital.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "452321480801",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:452321480801:web:a4dba6a40edc74e6a25a20",
};

// Initialize Firebase App Singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let fsInstance: any;
try {
  fsInstance = getFirestore(app, 'default');
} catch {
  fsInstance = getFirestore(app);
}

export const db = fsInstance;
export const storage = getStorage(app);

export default app;
