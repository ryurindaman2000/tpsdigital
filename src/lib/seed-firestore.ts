import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function seedAdminToFirestore() {
  try {
    const adminRef = doc(db, 'users', 'admin');
    const docSnap = await getDoc(adminRef);

    if (!docSnap.exists()) {
      await setDoc(adminRef, {
        nim: process.env.ADMIN_USERNAME || 'admin',
        name: 'Panitia Pemilihan (Admin)',
        randomPassword: process.env.ADMIN_PASSWORD || 'admin',
        role: 'ADMIN',
        hasVoted: false,
        createdAt: new Date().toISOString(),
      });
      console.log('✅ User Admin berhasil di-write ke Firestore!');
      return { success: true, message: 'User Admin berhasil dibuat di Firestore.' };
    } else {
      console.log('ℹ️ User Admin sudah ada di Firestore.');
      return { success: true, message: 'User Admin sudah ada di Firestore.' };
    }
  } catch (error: any) {
    console.error('❌ Gagal write Admin ke Firestore:', error);
    return { success: false, message: error.message };
  }
}
