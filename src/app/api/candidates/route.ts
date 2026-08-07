import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/candidates
export async function GET() {
  try {
    // 1. Coba ambil kandidat dari Firestore terlebih dahulu
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');

      const candidatesSnap = await getDocs(collection(fdb, 'candidates'));
      if (!candidatesSnap.empty) {
        const votesSnap = await getDocs(collection(fdb, 'votes'));
        const votesList: any[] = [];
        votesSnap.forEach((v) => {
          if (v.data().isValid !== false) votesList.push(v.data());
        });

        const fsCandidates: any[] = [];
        candidatesSnap.forEach((docSnap) => {
          const c = docSnap.data();
          const votesCount = votesList.filter(
            (v: any) =>
              Number(v.candidateId) === Number(docSnap.id) ||
              Number(v.candidateId) === Number(c.candidateNumber)
          ).length;
          fsCandidates.push({ id: docSnap.id, ...c, votesCount });
        });

        fsCandidates.sort((a, b) => (Number(a.candidateNumber) || 0) - (Number(b.candidateNumber) || 0));

        if (fsCandidates.length > 0) {
          return NextResponse.json({ success: true, data: fsCandidates });
        }
      }
    } catch (fsErr) {
      console.error('[Firestore Candidates GET Fallback]:', fsErr);
    }

    // 2. Fallback aman ke PostgreSQL (Prisma)
    let candidates: any[] = [];
    let votes: any[] = [];
    try {
      if (db.candidate && db.vote) {
        candidates = await db.candidate.findMany({ orderBy: { candidateNumber: 'asc' } });
        votes = await db.vote.findMany({ where: { isValid: true }, select: { candidateId: true } });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Candidates GET Fallback Ignored]:', pgErr);
    }

    const data = candidates.map((c: any) => {
      const votesCount = votes.filter(
        (v: any) =>
          Number(v.candidateId) === Number(c.id) ||
          Number(v.candidateId) === Number(c.candidateNumber)
      ).length;
      return { ...c, votesCount };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}

// POST /api/candidates - Tambah Paslon Baru
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      candidateNumber,
      chairmanName,
      viceChairmanName,
      chairmanPhoto,
      viceChairmanPhoto,
      vision,
      mission,
    } = body;

    if (!candidateNumber || !chairmanName || !viceChairmanName) {
      return NextResponse.json(
        { success: false, message: 'Nomor urut, Nama Ketua, dan Nama Wakil Ketua wajib diisi.' },
        { status: 400 }
      );
    }

    if (!chairmanPhoto || !viceChairmanPhoto) {
      return NextResponse.json(
        { success: false, message: 'Foto Calon Ketua dan Foto Calon Wakil Ketua wajib di-upload.' },
        { status: 400 }
      );
    }

    if (!vision || !mission) {
      return NextResponse.json(
        { success: false, message: 'Visi dan Misi wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedChairman = String(chairmanName).trim();
    const trimmedVice = String(viceChairmanName).trim();
    const fullName = `${trimmedChairman} & ${trimmedVice}`;

    let candidateResult: any = null;

    // 1. Simpan ke Firestore
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');

      const docRef = await addDoc(collection(fdb, 'candidates'), {
        candidateNumber: Number(candidateNumber),
        chairmanName: trimmedChairman,
        viceChairmanName: trimmedVice,
        name: fullName,
        chairmanPhoto,
        viceChairmanPhoto,
        photoUrl: chairmanPhoto,
        vision: String(vision).trim(),
        mission: String(mission).trim(),
        createdAt: new Date().toISOString(),
      });

      candidateResult = {
        id: docRef.id,
        candidateNumber: Number(candidateNumber),
        chairmanName: trimmedChairman,
        viceChairmanName: trimmedVice,
        name: fullName,
        chairmanPhoto,
        viceChairmanPhoto,
        photoUrl: chairmanPhoto,
        vision: String(vision).trim(),
        mission: String(mission).trim(),
      };
    } catch (fsErr) {
      console.error('[Firestore Candidate POST Error]:', fsErr);
    }

    // 2. Try Simpan ke PostgreSQL
    try {
      if (db.candidate) {
        candidateResult = await db.candidate.create({
          data: {
            candidateNumber: Number(candidateNumber),
            chairmanName: trimmedChairman,
            viceChairmanName: trimmedVice,
            name: fullName,
            chairmanPhoto,
            viceChairmanPhoto,
            photoUrl: chairmanPhoto,
            vision: String(vision).trim(),
            mission: String(mission).trim(),
          },
        });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Candidate POST Ignored]:', pgErr);
    }

    return NextResponse.json({ success: true, data: candidateResult }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan paslon.' },
      { status: 500 }
    );
  }
}

// PUT /api/candidates - Update Paslon
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      candidateNumber,
      chairmanName,
      viceChairmanName,
      chairmanPhoto,
      viceChairmanPhoto,
      vision,
      mission,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Paslon tidak valid.' },
        { status: 400 }
      );
    }

    const trimmedChairman = String(chairmanName).trim();
    const trimmedVice = String(viceChairmanName).trim();
    const fullName = `${trimmedChairman} & ${trimmedVice}`;

    let updatedResult: any = {
      id,
      candidateNumber: Number(candidateNumber),
      chairmanName: trimmedChairman,
      viceChairmanName: trimmedVice,
      name: fullName,
    };

    // 1. Update ke Firestore
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');

      await setDoc(doc(fdb, 'candidates', String(id)), {
        candidateNumber: Number(candidateNumber),
        chairmanName: trimmedChairman,
        viceChairmanName: trimmedVice,
        name: fullName,
        chairmanPhoto,
        viceChairmanPhoto,
        photoUrl: chairmanPhoto,
        vision: String(vision).trim(),
        mission: String(mission).trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fsErr) {
      console.error('[Firestore Candidate PUT Error]:', fsErr);
    }

    // 2. Try Update ke PostgreSQL
    try {
      if (db.candidate && !isNaN(Number(id))) {
        updatedResult = await db.candidate.update({
          where: { id: Number(id) },
          data: {
            candidateNumber: Number(candidateNumber),
            chairmanName: trimmedChairman,
            viceChairmanName: trimmedVice,
            name: fullName,
            chairmanPhoto,
            viceChairmanPhoto,
            photoUrl: chairmanPhoto,
            vision: String(vision).trim(),
            mission: String(mission).trim(),
          },
        });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Candidate PUT Ignored]:', pgErr);
    }

    return NextResponse.json({ success: true, data: updatedResult });
  } catch (error: any) {
    console.error('Error updating candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal merubah data paslon.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id ? String(body.id) : null;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Paslon wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Delete dari Firestore
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db: fdb } = await import('@/lib/firebase');
      await deleteDoc(doc(fdb, 'candidates', String(id)));
    } catch (fsErr) {
      console.error('[Firestore Candidate DELETE Error]:', fsErr);
    }

    // 2. Try Delete dari PostgreSQL
    try {
      if (db.candidate && !isNaN(Number(id))) {
        await db.candidate.delete({
          where: { id: Number(id) },
        });
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL Candidate DELETE Ignored]:', pgErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Pasangan calon berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus paslon.' },
      { status: 500 }
    );
  }
}
