'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Vote,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  AlertCircle,
  LoaderCircle,
  HelpCircle,
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
}

function VotingBoothContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');

  const [voterName, setVoterName] = useState<string>('Pemilih TPS');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verifikasi Sesi Login Pemilih & Fetch Pengaturan
  useEffect(() => {
    // 1. Cek Sesi Server
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.user || data.user.role !== 'VOTER') {
          router.replace('/');
          return;
        }
        if (data.user.name) setVoterName(data.user.name);
      })
      .catch(() => {
        router.replace('/');
      });

    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localSub = localStorage.getItem('app_subtitle');
      const localLogo = localStorage.getItem('app_logo');

      if (localName) setAppName(localName);
      if (localSub) setSubTitle(localSub);
      if (localLogo) setLogoUrl(localLogo);
    }
  }, [router]);

  // Fetch daftar paslon
  useEffect(() => {
    fetch('/api/candidates')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setCandidates(json.data);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Submit Pilihan Suara
  const handleConfirmVote = async () => {
    if (!selectedCandidate) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: selectedCandidate.id }),
      });

      if (!res.ok) {
        throw new Error('Gagal mengirimkan suara.');
      }

      setIsSubmitModalOpen(false);
      setIsSuccessModalOpen(true);

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('voter_name');
          localStorage.removeItem('voter_nim');
        }
        router.push('/live-count');
      }, 3000);
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan suara.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* FULL-WIDTH STICKY TOP BAR HEADER (Clean White Theme) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        {/* Sisi Kiri Top Bar: Logo & Nama Aplikasi */}
        <div className="flex items-center gap-3.5">
          <img
            src={activeLogoSrc}
            alt="Logo"
            className="h-10 w-auto object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {appName}
            </h1>
            <p className="text-xs text-slate-500">{subTitle}</p>
          </div>
        </div>

        {/* Sisi Kanan Top Bar: Identitas Pemilih */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pemilih Aktif</span>
            <span className="text-xs font-bold text-emerald-600">{voterName}</span>
          </div>
          <button
            onClick={() => router.push('/')}
            className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl border border-slate-200 transition"
            title="Keluar dari Bilik Suara"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* Banner Selamat Datang */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md">
          <div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-full border border-emerald-200 inline-block mb-2">
              SURAT SUARA DIGITAL PEMILIHAN
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Selamat Datang di Bilik Suara, {voterName}!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Silakan pelajari visi-misi pasangan calon di bawah ini, kemudian klik tombol <strong>"Pilih Paslon Ini"</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Pilihan Anda dijamin Rahasia & Anonim</span>
          </div>
        </div>

        {/* Daftar Pasangan Calon */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((paslon) => {
            const chairmanNameDisplay = paslon.chairmanName || paslon.name.split('&')[0]?.trim() || paslon.name;
            const viceChairmanNameDisplay = paslon.viceChairmanName || paslon.name.split('&')[1]?.trim() || '';

            return (
              <div
                key={paslon.id}
                className={`bg-white border rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-md transition group relative ${
                  selectedCandidate?.id === paslon.id
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Nomor Urut */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg text-xs border border-emerald-200">
                    PASLON 0{paslon.candidateNumber}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    SURAT SUARA #0{paslon.candidateNumber}
                  </span>
                </div>

                {/* Photos Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Photo Chairman */}
                  <div className="space-y-2 text-center">
                    <div className="w-full h-40 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1">
                      {paslon.chairmanPhoto ? (
                        <img
                          src={paslon.chairmanPhoto}
                          alt={chairmanNameDisplay}
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
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 break-words break-all">
                        {chairmanNameDisplay}
                      </h4>
                    </div>
                  </div>

                  {/* Photo Vice Chairman */}
                  <div className="space-y-2 text-center">
                    <div className="w-full h-40 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1">
                      {paslon.viceChairmanPhoto ? (
                        <img
                          src={paslon.viceChairmanPhoto}
                          alt={viceChairmanNameDisplay}
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
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 break-words break-all">
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

                {/* Button Choose */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedCandidate(paslon);
                      setIsSubmitModalOpen(true);
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Pilih Paslon Ini</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Security */}
      <footer className="max-w-7xl mx-auto w-full text-center py-4 text-xs text-slate-500 flex justify-between items-center flex-wrap gap-2 px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Sistem E-Voting Terenkripsi & Transparan</span>
        </div>
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

      {/* MODAL: Konfirmasi Pilihan Suara */}
      {isSubmitModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900 text-center">
            <div className="inline-flex p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600">
              <Vote className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Konfirmasi Suara Anda</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin memberikan suara Anda kepada:
              </p>
              <div className="mt-3 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold text-center leading-relaxed break-words break-all max-h-36 overflow-y-auto">
                <span className="block text-[11px] uppercase tracking-wider text-emerald-600 font-extrabold mb-1">
                  PASLON 0{selectedCandidate.candidateNumber}
                </span>
                <span>
                  {selectedCandidate.chairmanName || selectedCandidate.name.split('&')[0]?.trim() || selectedCandidate.name}
                  {selectedCandidate.viceChairmanName
                    ? ` & ${selectedCandidate.viceChairmanName}`
                    : selectedCandidate.name.includes('&')
                    ? ` & ${selectedCandidate.name.split('&')[1]?.trim()}`
                    : ''}
                </span>
              </div>
              <p className="text-[11px] text-amber-600 mt-2 font-medium">
                ⚠️ Pilihan suara bersifat final dan tidak dapat diubah setelah dikonfirmasi.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
              >
                Batal / Cek Lagi
              </button>
              <button
                onClick={handleConfirmVote}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim Suara...' : 'Ya, Kirim Suara'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sukses Memilih */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-emerald-200 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-4 text-slate-900">
            <div className="inline-flex p-4 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Suara Anda Berhasil Disimpan!</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Terima kasih <strong>{voterName}</strong> telah berpartisipasi. Anda akan otomatis dialihkan ke Monitor Quick Count...
              </p>
            </div>

            <div className="pt-2">
              <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs">
        <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
        <span>Memuat Bilik Suara...</span>
      </div>
    }>
      <VotingBoothContent />
    </Suspense>
  );
}
