import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/candidates
export async function GET() {
  try {
    const candidates = await db.candidate.findMany({
      orderBy: { candidateNumber: 'asc' },
    });

    const votes = await db.vote.findMany({
      where: { isValid: true },
      select: { candidateId: true },
    });

    const data = candidates.map((c: any) => {
      const votesCount = votes.filter(
        (v: any) =>
          Number(v.candidateId) === Number(c.id) ||
          Number(v.candidateId) === Number(c.candidateNumber)
      ).length;
      return {
        ...c,
        votesCount,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data paslon dari database.' },
      { status: 500 }
    );
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

    // Cek Duplikasi Nomor Urut
    const existingNumber = await db.candidate.findUnique({
      where: { candidateNumber: Number(candidateNumber) },
    });

    if (existingNumber) {
      return NextResponse.json(
        {
          success: false,
          isDuplicate: true,
          message: `Nomor urut 0${candidateNumber} sudah digunakan oleh Paslon "${existingNumber.name}".`,
        },
        { status: 400 }
      );
    }

    const candidate = await db.candidate.create({
      data: {
        candidateNumber: Number(candidateNumber),
        chairmanName: trimmedChairman,
        viceChairmanName: trimmedVice,
        name: fullName,
        chairmanPhoto: chairmanPhoto,
        viceChairmanPhoto: viceChairmanPhoto,
        photoUrl: chairmanPhoto,
        vision: String(vision).trim(),
        mission: String(mission).trim(),
      },
    });

    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan paslon ke PostgreSQL.' },
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

    const candidate = await db.candidate.update({
      where: { id: Number(id) },
      data: {
        candidateNumber: Number(candidateNumber),
        chairmanName: trimmedChairman,
        viceChairmanName: trimmedVice,
        name: fullName,
        chairmanPhoto: chairmanPhoto || null,
        viceChairmanPhoto: viceChairmanPhoto || null,
        photoUrl: chairmanPhoto || viceChairmanPhoto || null,
        vision: String(vision).trim(),
        mission: String(mission).trim(),
      },
    });

    return NextResponse.json({ success: true, data: candidate });
  } catch (error: any) {
    console.error('Error updating candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui paslon di PostgreSQL.' },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates - Hapus Paslon
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Paslon tidak ditemukan.' },
        { status: 400 }
      );
    }

    await db.candidate.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Paslon berhasil dihapus.' });
  } catch (error: any) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus paslon.' },
      { status: 500 }
    );
  }
}
