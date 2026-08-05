'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  FileText,
  CheckCircle2,
  Users,
  Award,
  Calendar,
  Building,
} from 'lucide-react';

interface CandidateReport {
  id: number;
  candidateNumber: number;
  chairmanName: string;
  viceChairmanName: string;
  votesCount: number;
  percentage: string;
}

export default function ReportsAdminPage() {
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');
  const [kopUrl, setKopUrl] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateReport[]>([]);
  const [totalVoters, setTotalVoters] = useState(0);
  const [hasVotedCount, setHasVotedCount] = useState(0);
  const [notVotedCount, setNotVotedCount] = useState(0);
  const [turnoutPercent, setTurnoutPercent] = useState('0%');

  const [locationName, setLocationName] = useState('TPS 01 - Wilayah Utama');
  const [eventDate, setEventDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Signatories
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ketuaName, setKetuaName] = useState('');
  const [witnessNames, setWitnessNames] = useState<Record<number, string>>({});

  // Handler update witness name per paslon
  const handleWitnessChange = (candidateNum: number, name: string) => {
    setWitnessNames((prev) => ({ ...prev, [candidateNum]: name }));
  };

  const handleOpenPrintModal = () => {
    setIsModalOpen(true);
  };

  const handleConfirmPrint = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Fetch Pengaturan & Data Rekapitulasi Suara Real-Time
  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // Settings
      const settingsRes = await fetch('/api/settings');
      const settingsJson = await settingsRes.json();
      if (settingsJson.success && settingsJson.data) {
        if (settingsJson.data.appName) setAppName(settingsJson.data.appName);
        if (settingsJson.data.logoUrl) setLogoUrl(settingsJson.data.logoUrl);
        if (settingsJson.data.kopUrl) setKopUrl(settingsJson.data.kopUrl);
      }

      // Candidates & Votes
      const candidatesRes = await fetch('/api/candidates');
      const candidatesJson = await candidatesRes.json();

      // Voters Stat
      const votersRes = await fetch('/api/voters');
      const votersJson = await votersRes.json();

      let totalV = 0;
      let votedV = 0;
      if (votersJson.success && Array.isArray(votersJson.data)) {
        totalV = votersJson.data.length;
        votedV = votersJson.data.filter((v: any) => v.hasVoted).length;
      }

      setTotalVoters(totalV);
      setHasVotedCount(votedV);
      setNotVotedCount(Math.max(0, totalV - votedV));
      setTurnoutPercent(
        totalV > 0 ? `${((votedV / totalV) * 100).toFixed(1)}%` : '0%'
      );

      if (candidatesJson.success && Array.isArray(candidatesJson.data) && candidatesJson.data.length > 0) {
        const mapped: CandidateReport[] = candidatesJson.data.map((c: any) => {
          const count = c.votesCount || c._count?.votes || 0;
          const pct = votedV > 0 ? ((count / votedV) * 100).toFixed(1) + '%' : '0%';
          return {
            id: c.id,
            candidateNumber: c.candidateNumber,
            chairmanName: c.chairmanName || c.name || `Paslon 0${c.candidateNumber}`,
            viceChairmanName: c.viceChairmanName || '',
            votesCount: count,
            percentage: pct,
          };
        });
        setCandidates(mapped);
      } else {
        setCandidates([
          { id: 1, candidateNumber: 1, chairmanName: 'Pasangan Calon 01', viceChairmanName: '', votesCount: 0, percentage: '0%' },
          { id: 2, candidateNumber: 2, chairmanName: 'Pasangan Calon 02', viceChairmanName: '', votesCount: 0, percentage: '0%' },
        ]);
      }
    } catch (err) {
      console.error('Gagal mengambil laporan berita acara:', err);
      setCandidates([
        { id: 1, candidateNumber: 1, chairmanName: 'Pasangan Calon 01', viceChairmanName: '', votesCount: 0, percentage: '0%' },
        { id: 2, candidateNumber: 2, chairmanName: 'Pasangan Calon 02', viceChairmanName: '', votesCount: 0, percentage: '0%' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const activeLogoSrc = logoUrl || '/images/default-logo.png';
  const activeKopSrc = kopUrl || (typeof window !== 'undefined' ? localStorage.getItem('app_kop') || '' : '');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between print:bg-white print:p-0">
      {/* Header Admin (Sembunyi Saat Cetak) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm print:hidden">
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
            {appName} - Berita Acara TPS
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenPrintModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Berita Acara (PDF)</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6 print:p-0 print:m-0 print:max-w-none">
        {/* Tombol Akses Atas (Sembunyi Saat Cetak) */}
        <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenPrintModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Isi Penandatangan & Cetak PDF</span>
          </button>
        </div>

        {/* LEMBAR DOKUMEN RESMI BERITA ACARA */}
        <div className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:p-4 space-y-6 text-slate-900 font-serif">
          {/* Header Kop Surat Dokumen */}
          {activeKopSrc ? (
            <div className="border-b-2 border-slate-900 pb-3 text-center">
              <img
                src={activeKopSrc}
                alt="Kop Surat Resmi"
                className="max-h-24 w-full object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4 font-sans">
              <div className="flex items-center gap-3">
                <img src={activeLogoSrc} alt="Logo" className="h-12 w-auto object-contain" />
                <div>
                  <h2 className="text-xl font-black text-slate-900">{appName}</h2>
                  <p className="text-xs font-semibold text-emerald-700">PANITIA PEMILIHAN SUARA TPS DIGITAL</p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                DOKUMEN RESMI REKAPITULASI
              </div>
            </div>
          )}

          {/* Judul Berita Acara */}
          <div className="text-center space-y-1 py-2">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide border-b-2 border-slate-900 inline-block px-4 pb-0.5">
              BERITA ACARA REKAPITULASI PERHITUNGAN SUARA
            </h2>
            <p className="text-xs font-sans text-slate-600 font-medium">
              Nomor: BA/{new Date().getFullYear()}/TPS-DIGITAL/{Math.floor(100 + Math.random() * 900)}
            </p>
          </div>

          {/* Pengantar Berita Acara */}
          <div className="text-xs leading-relaxed space-y-2 font-sans text-slate-800">
            <p>
              Pada hari ini <strong className="font-bold">{eventDate}</strong>, telah dilaksanakan perhitungan suara Pemilihan Umum secara digital di <strong className="font-bold">{locationName}</strong> dengan hasil rekapitulasi sebagai berikut:
            </p>
          </div>

          {/* I. STATISTIK PEROLEHAN SUARA PASANGAN CALON */}
          <div className="space-y-3 font-sans">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-emerald-600 pl-2">
              I. PEROLEHAN SUARA PASANGAN CALON
            </h3>

            <div className="border border-slate-900 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-900 font-bold text-slate-900">
                    <th className="p-2.5 border-r border-slate-900 text-center w-12">NO</th>
                    <th className="p-2.5 border-r border-slate-900">NAMA PASANGAN CALON</th>
                    <th className="p-2.5 border-r border-slate-900 text-center w-32">SUARA SAH</th>
                    <th className="p-2.5 text-center w-28">PERSENTASE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">
                        Belum ada data pasangan calon.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2.5 border-r border-slate-900 text-center font-bold">
                          0{c.candidateNumber}
                        </td>
                        <td className="p-2.5 border-r border-slate-900 font-bold text-slate-900">
                          {c.chairmanName} {c.viceChairmanName ? `& ${c.viceChairmanName}` : ''}
                        </td>
                        <td className="p-2.5 border-r border-slate-900 text-center font-mono font-bold text-emerald-700 text-sm">
                          {c.votesCount} Suara
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {c.percentage}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                    <td colSpan={2} className="p-2.5 border-r border-slate-900 text-right uppercase">
                      TOTAL SUARA SAH MASUK:
                    </td>
                    <td className="p-2.5 border-r border-slate-900 text-center font-mono text-emerald-800 text-sm">
                      {hasVotedCount} Suara
                    </td>
                    <td className="p-2.5 text-center font-mono">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* II. RINCIAN PARTISIPASI PEMILIH TPS */}
          <div className="space-y-3 font-sans pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-emerald-600 pl-2">
              II. RINCIAN PARTISIPASI PEMILIH
            </h3>

            <div className="border border-slate-900 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-300">
                <div className="p-2.5 bg-slate-50 font-medium">Total Pemilih Terdaftar (DPT):</div>
                <div className="p-2.5 font-mono font-bold text-slate-900">{totalVoters} Pemilih</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-300">
                <div className="p-2.5 bg-slate-50 font-medium">Total Pemilih Menggunakan Hak Pilih:</div>
                <div className="p-2.5 font-mono font-bold text-emerald-700">{hasVotedCount} Pemilih</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-300">
                <div className="p-2.5 bg-slate-50 font-medium">Total Pemilih Tidak Menggunakan Hak Pilih:</div>
                <div className="p-2.5 font-mono font-bold text-slate-500">{notVotedCount} Pemilih</div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-900 bg-slate-100 font-bold">
                <div className="p-2.5 uppercase">Tingkat Partisipasi Pemilih:</div>
                <div className="p-2.5 font-mono text-purple-700">{turnoutPercent}</div>
              </div>
            </div>
          </div>

          {/* III. PENUTUP & TANDA TANGAN SAKSI */}
          <div className="space-y-4 font-sans pt-4">
            <p className="text-xs leading-relaxed text-slate-800">
              Demikian Berita Acara Rekapitulasi Perhitungan Suara ini dibuat dengan sebenarnya tanpa ada paksaan dari pihak manapun, untuk dipergunakan sebagaimana mestinya.
            </p>

            <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
              {/* Kolom Saksi-Saksi Paslon */}
              <div>
                <span className="font-bold block uppercase tracking-wider text-slate-700 mb-2">
                  SAKSI-SAKSI PASLON:
                </span>
                <div className="flex justify-around gap-4">
                  {candidates.map((c) => {
                    const witness = witnessNames[c.candidateNumber];
                    return (
                      <div key={c.id} className="flex flex-col items-center text-center flex-1">
                        <div className="h-12"></div>
                        <div className="border-b-2 border-slate-900 pb-1 font-bold text-slate-900 text-[11px] w-11/12 mx-auto">
                          ( {witness ? witness : '....................................'} )
                        </div>
                        <span className="text-[10px] text-slate-600 font-semibold block mt-1">
                          Saksi Paslon 0{c.candidateNumber}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Ketua TPS */}
              <div>
                <span className="font-bold block uppercase tracking-wider text-slate-700 mb-2">
                  PANITIA PEMILIHAN TPS:
                </span>
                <div className="flex flex-col items-center text-center max-w-[220px] mx-auto">
                  <div className="h-12"></div>
                  <div className="border-b-2 border-slate-900 pb-1 font-bold text-slate-900 text-xs w-full">
                    ( {ketuaName ? ketuaName : 'KETUA KPPS TPS'} )
                  </div>
                  <span className="text-[10px] text-slate-600 font-semibold block mt-1">
                    Ketua KPPS / Panitia TPS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL POPUP: INPUT KETUA KPPS & SAKSI SAKSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lengkapi Data Penandatangan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi nama Ketua KPPS dan Saksi sesuai jumlah paslon terdaftar.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPrint} className="space-y-4 text-xs">
              {/* Input Ketua KPPS */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                  Nama Ketua KPPS / TPS:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Drs. H. Ahmad Dahlan"
                  value={ketuaName}
                  onChange={(e) => setKetuaName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-semibold"
                />
              </div>

              {/* Dynamic Inputs Saksi Saksi Per Paslon */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                  Nama Saksi Pasangan Calon:
                </label>
                {candidates.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-700 block">
                      • Saksi Paslon 0{c.candidateNumber} ({c.chairmanName})
                    </span>
                    <input
                      type="text"
                      placeholder={`Nama Saksi Paslon 0${c.candidateNumber}`}
                      value={witnessNames[c.candidateNumber] || ''}
                      onChange={(e) => handleWitnessChange(c.candidateNumber, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-semibold"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak PDF</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer (Sembunyi Saat Cetak) */}
      <footer className="max-w-7xl mx-auto w-full text-center py-4 text-xs text-slate-500 flex justify-center items-center flex-wrap gap-2 px-6 print:hidden">
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
