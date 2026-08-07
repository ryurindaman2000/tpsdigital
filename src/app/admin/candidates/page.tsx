'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Upload,
  X,
  Check,
  AlertTriangle,
  LoaderCircle,
  Vote,
  UserPlus,
} from 'lucide-react';

interface Candidate {
  id: number;
  candidateNumber: number;
  chairmanName: string;
  viceChairmanName: string;
  name: string;
  chairmanPhoto?: string | null;
  viceChairmanPhoto?: string | null;
  vision?: string | null;
  mission?: string | null;
  voteCount: number;
}

export default function AdminCandidatesPage() {
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState<number | null>(null);

  // Form Fields
  const [candidateNumber, setCandidateNumber] = useState<number>(1);
  const [chairmanName, setChairmanName] = useState('');
  const [viceChairmanName, setViceChairmanName] = useState('');
  const [chairmanPhoto, setChairmanPhoto] = useState<string | null>(null);
  const [viceChairmanPhoto, setViceChairmanPhoto] = useState<string | null>(null);
  const [vision, setVision] = useState('');
  const [mission, setMission] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);

  // Duplicate Number Error Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateErrorMsg, setDuplicateErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localLogo = localStorage.getItem('app_logo');

      if (localName) setAppName(localName);
      if (localLogo) setLogoUrl(localLogo);
    }
  }, []);

  // Fetch candidates
  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/candidates');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCandidates(json.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data kandidat:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Open Modal Tambah Paslon Baru
  const handleOpenAddModal = () => {
    setEditingCandidateId(null);
    const nextNumber = candidates.length > 0
      ? Math.max(...candidates.map((c) => c.candidateNumber)) + 1
      : 1;
    setCandidateNumber(nextNumber);
    setChairmanName('');
    setViceChairmanName('');
    setChairmanPhoto(null);
    setViceChairmanPhoto(null);
    setVision('');
    setMission('');
    setIsModalOpen(true);
  };

  // Open Modal Edit Paslon
  const handleOpenEditModal = (candidate: Candidate) => {
    setEditingCandidateId(candidate.id);
    setCandidateNumber(candidate.candidateNumber);

    const cName = candidate.chairmanName || candidate.name.split('&')[0]?.trim() || candidate.name;
    const vName = candidate.viceChairmanName || candidate.name.split('&')[1]?.trim() || '';

    setChairmanName(cName);
    setViceChairmanName(vName);
    setChairmanPhoto(candidate.chairmanPhoto || null);
    setViceChairmanPhoto(candidate.viceChairmanPhoto || null);
    setVision(candidate.vision || '');
    setMission(candidate.mission || '');
    setIsModalOpen(true);
  };

  // Convert File to Base64
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Simpan atau Update Candidate
  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chairmanName.trim() || !viceChairmanName.trim()) {
      setDuplicateErrorMsg('Nama Calon Ketua dan Wakil Ketua wajib diisi.');
      setIsDuplicateModalOpen(true);
      return;
    }

    if (!vision.trim() || !mission.trim()) {
      setDuplicateErrorMsg('Visi dan Misi wajib diisi.');
      setIsDuplicateModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = editingCandidateId !== null;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch('/api/candidates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCandidateId,
          candidateNumber: Number(candidateNumber),
          chairmanName: chairmanName.trim(),
          viceChairmanName: viceChairmanName.trim(),
          chairmanPhoto,
          viceChairmanPhoto,
          vision: vision.trim(),
          mission: mission.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDuplicateErrorMsg(data.message || 'Data pasangan calon gagal disimpan.');
        setIsDuplicateModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      fetchCandidates();
    } catch (err) {
      setDuplicateErrorMsg('Terjadi kesalahan sistem database.');
      setIsDuplicateModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Candidate
  const handleDeleteCandidate = async () => {
    if (!deletingCandidate) return;

    try {
      const res = await fetch('/api/candidates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingCandidate.id }),
      });

      if (res.ok) {
        setIsDeleteModalOpen(false);
        setDeletingCandidate(null);
        fetchCandidates();
      } else {
        alert('Gagal menghapus kandidat.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header Admin */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={activeLogoSrc}
            alt="Logo"
            className="h-9 w-auto object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h1 className="text-base font-bold text-slate-900">
            {appName} - Manajemen Pasangan Calon (Paslon)
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paslon Baru</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-slate-500 shadow-md">
            <LoaderCircle className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-medium">Memuat data paslon...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-md">
            <p className="text-sm font-bold text-slate-900">Belum Ada Paslon Terdaftar</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Silakan klik tombol <strong>+ Tambah Paslon Baru</strong> untuk mendaftarkan kandidat.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((paslon) => {
              const chairmanNameDisplay = paslon.chairmanName || paslon.name.split('&')[0]?.trim() || paslon.name;
              const viceChairmanNameDisplay = paslon.viceChairmanName || paslon.name.split('&')[1]?.trim() || '';

              return (
                <div
                  key={paslon.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-md hover:border-emerald-500/50 transition group"
                >
                  <div className="space-y-4">
                    {/* Header Badge & Action Buttons */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg text-xs border border-emerald-200">
                        PASLON 0{paslon.candidateNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(paslon)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition border border-slate-200"
                          title="Edit Paslon"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingCandidate(paslon);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition border border-slate-200"
                          title="Hapus Paslon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Photos Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Photo Chairman */}
                      <div className="space-y-2 text-center">
                        <div className="w-full h-36 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1">
                          {paslon.chairmanPhoto ? (
                            <img
                              src={paslon.chairmanPhoto}
                              alt={chairmanNameDisplay}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="text-slate-400 text-xs font-medium">Foto Ketua</div>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                            Calon Ketua
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {chairmanNameDisplay}
                          </h4>
                        </div>
                      </div>

                      {/* Photo Vice Chairman */}
                      <div className="space-y-2 text-center">
                        <div className="w-full h-36 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1">
                          {paslon.viceChairmanPhoto ? (
                            <img
                              src={paslon.viceChairmanPhoto}
                              alt={viceChairmanNameDisplay}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="text-slate-400 text-xs font-medium">Foto Wakil</div>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                            Calon Wakil
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {viceChairmanNameDisplay}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* Vision & Mission */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      {paslon.vision && (
                        <div>
                          <strong className="text-slate-800 block mb-0.5">Visi:</strong>
                          <p className="line-clamp-2 italic text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            {paslon.vision}
                          </p>
                        </div>
                      )}

                      {paslon.mission && (
                        <div>
                          <strong className="text-slate-800 block mb-0.5">Misi:</strong>
                          <p className="line-clamp-3 whitespace-pre-line text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            {paslon.mission}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vote Count Indicator */}
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Perolehan Suara:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {paslon.voteCount || 0} Suara
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL: Form Tambah / Edit Paslon */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCandidateId ? 'Edit Data Paslon' : 'Tambah Paslon Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="space-y-4">
              {/* Nomor Urut */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Urut <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={candidateNumber}
                  onChange={(e) => setCandidateNumber(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-emerald-700 font-bold focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              {/* Nama Calon Ketua & Nama Calon Wakil Ketua */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Calon Ketua <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Fauzi"
                    value={chairmanName}
                    onChange={(e) => setChairmanName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Calon Wakil Ketua <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rina Wijaya"
                    value={viceChairmanName}
                    onChange={(e) => setViceChairmanName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                  />
                </div>
              </div>

              {/* IMAGE PICKERS KETUA & WAKIL KETUA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Image Picker Ketua */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Foto Calon Ketua
                  </label>
                  <div className="w-full h-32 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
                    {chairmanPhoto ? (
                      <div className="w-full h-full relative">
                        <img
                          src={chairmanPhoto}
                          alt="Preview Ketua"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setChairmanPhoto(null)}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-lg text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-center p-2">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-500 block">Pilih Foto Ketua</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, setChairmanPhoto)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Image Picker Wakil */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Foto Calon Wakil
                  </label>
                  <div className="w-full h-32 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
                    {viceChairmanPhoto ? (
                      <div className="w-full h-full relative">
                        <img
                          src={viceChairmanPhoto}
                          alt="Preview Wakil"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setViceChairmanPhoto(null)}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-lg text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-center p-2">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-500 block">Pilih Foto Wakil</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, setViceChairmanPhoto)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Visi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Visi Paslon <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Tuliskan Visi Utama Pasangan Calon..."
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              {/* Misi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Misi Paslon <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan poin-poin Misi Pasangan Calon..."
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Paslon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Paslon */}
      {isDeleteModalOpen && deletingCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-5 text-slate-900">
            <div className="inline-flex p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600">
              <Trash2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Hapus Pasangan Calon</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong className="text-red-600">Paslon 0{deletingCandidate.candidateNumber} ({deletingCandidate.chairmanName || deletingCandidate.name})</strong> dari database?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteCandidate}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-600/20"
              >
                Hapus Permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Duplicate Number Error */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-amber-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-5 text-slate-900">
            <div className="inline-flex p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-600">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Peringatan Input Form</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-200">
                {duplicateErrorMsg}
              </p>
            </div>

            <button
              onClick={() => setIsDuplicateModalOpen(false)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20"
            >
              Perbaiki / Lengkapi Data
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center py-4 text-xs text-slate-500 flex justify-center items-center flex-wrap gap-2 px-6">
        <span>© 2026 Admin TPS E-Voting</span>
        <span>•</span>
        <span>
          Powered by{' '}
          <a
            href="https://pancakalabs.my.id"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-emerald-600 hover:underline"
          >
            Pancakalabs
          </a>
        </span>
      </footer>
    </div>
  );
}
