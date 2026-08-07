'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Award,
  TrendingUp,
  CheckCircle2,
  Settings,
  FileSpreadsheet,
  FileText,
  Printer,
  UserPlus,
  RefreshCw,
  LogOut,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');

  const [stats, setStats] = useState({
    totalVoters: 0,
    hasVotedCount: 0,
    turnoutPercent: '0%',
    totalCandidates: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  // State Cetak Berita Acara Modal dari Dashboard
  const [isBeritaAcaraModalOpen, setIsBeritaAcaraModalOpen] = useState(false);
  const [ketuaName, setKetuaName] = useState('');
  const [witnessNames, setWitnessNames] = useState<Record<number, string>>({});
  const [candidatesList, setCandidatesList] = useState<any[]>([]);
  const [kopUrl, setKopUrl] = useState<string | null>(null);

  const [isOpeningBeritaAcara, setIsOpeningBeritaAcara] = useState(false);

  const handleWitnessChange = (candidateNum: number, name: string) => {
    setWitnessNames((prev) => ({ ...prev, [candidateNum]: name }));
  };

  const handleOpenBeritaAcaraModal = async () => {
    if (isOpeningBeritaAcara) return;
    setIsOpeningBeritaAcara(true);

    try {
      // Fetch settings & candidates secara PARALEL untuk respon instan
      const [settingsRes, candidatesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/candidates'),
      ]);

      const [settingsJson, json] = await Promise.all([
        settingsRes.json(),
        candidatesRes.json(),
      ]);

      if (settingsJson.success && settingsJson.data) {
        if (settingsJson.data.kopUrl) {
          setKopUrl(settingsJson.data.kopUrl);
          if (typeof window !== 'undefined') localStorage.setItem('app_kop', settingsJson.data.kopUrl);
        }
      }

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const mapped = json.data.map((c: any) => ({
          id: c.id,
          candidateNumber: c.candidateNumber,
          chairmanName: c.chairmanName || c.name || `Paslon 0${c.candidateNumber}`,
          viceChairmanName: c.viceChairmanName || '',
          votesCount: c.votesCount || c._count?.votes || 0,
        }));
        setCandidatesList(mapped);
      } else {
        setCandidatesList([
          { id: 1, candidateNumber: 1, chairmanName: 'Pasangan Calon 01', viceChairmanName: '', votesCount: 0 },
          { id: 2, candidateNumber: 2, chairmanName: 'Pasangan Calon 02', viceChairmanName: '', votesCount: 0 },
        ]);
      }
    } catch (e) {
      setCandidatesList([
        { id: 1, candidateNumber: 1, chairmanName: 'Pasangan Calon 01', viceChairmanName: '', votesCount: 0 },
        { id: 2, candidateNumber: 2, chairmanName: 'Pasangan Calon 02', viceChairmanName: '', votesCount: 0 },
      ]);
    } finally {
      setIsOpeningBeritaAcara(false);
      setIsBeritaAcaraModalOpen(true);
    }
  };

  const handleConfirmPrintBeritaAcara = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBeritaAcaraModalOpen(false);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Harap izinkan pop-up untuk mencetak Berita Acara.');
      return;
    }

    const kopSrc = kopUrl || (typeof window !== 'undefined' ? localStorage.getItem('app_kop') || '' : '');
    const activeLogoSrc = logoUrl || '/images/default-logo.png';
    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const candidateRowsHtml =
      candidatesList.length === 0
        ? `<tr><td colspan="4" style="padding:12px; text-align:center; color:#64748b; font-style:italic;">Belum ada data pasangan calon.</td></tr>`
        : candidatesList
            .map(
              (c) => `
      <tr>
        <td style="padding:8px 12px; border-right:1px solid #0f172a; border-bottom:1px solid #0f172a; text-align:center; font-weight:bold;">0${c.candidateNumber}</td>
        <td style="padding:8px 12px; border-right:1px solid #0f172a; border-bottom:1px solid #0f172a; font-weight:bold;">${c.chairmanName} ${c.viceChairmanName ? '& ' + c.viceChairmanName : ''}</td>
        <td style="padding:8px 12px; border-right:1px solid #0f172a; border-bottom:1px solid #0f172a; text-align:center; font-family:monospace; font-weight:bold; color:#047857;">${c.votesCount || 0} Suara</td>
        <td style="padding:8px 12px; border-bottom:1px solid #0f172a; text-align:center; font-family:monospace; font-weight:bold;">${
          stats.hasVotedCount > 0 ? (((c.votesCount || 0) / stats.hasVotedCount) * 100).toFixed(1) + '%' : '0%'
        }</td>
      </tr>
    `
            )
            .join('');

    const witnessesHtml = candidatesList
      .map((c) => {
        const wName = witnessNames[c.candidateNumber] || '';
        return `
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; flex:1;">
          <div style="height:45px;"></div>
          <div style="border-bottom:1.5px solid #0f172a; padding-bottom:3px; font-weight:bold; font-size:11px; width:90%; margin:0 auto;">
            ( ${wName ? wName : '....................................'} )
          </div>
          <span style="font-size:10px; color:#475569; font-weight:600; margin-top:4px; display:block;">Saksi Paslon 0${c.candidateNumber}</span>
        </div>
      `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Berita Acara Rekapitulasi Perhitungan Suara TPS</title>
          <style>
            @page { size: A4 portrait; margin: 6mm 10mm 10mm 10mm; }
            body { font-family: system-ui, -apple-system, sans-serif; background: #fff; margin: 0; padding: 0; color: #0f172a; }
            .header-kop { margin-bottom: 6px; text-align: center; }
            .header-kop img { max-height: 32mm; width: 100%; object-fit: contain; display: block; margin: 0 auto; }
            .header-default { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
            .header-logo { height: 36px; }
            .title-box { text-align: center; margin: 8px 0 10px 0; }
            .doc-title { font-size: 14px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #0f172a; display: inline-block; padding-bottom: 2px; }
            .doc-num { font-size: 10px; color: #0f172a; font-weight: 600; margin-top: 4px; }
            .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; border-left: 4px solid #059669; padding-left: 6px; margin: 10px 0 4px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #0f172a; }
            th { background: #f1f5f9; padding: 6px 8px; border-right: 1px solid #0f172a; border-bottom: 1px solid #0f172a; text-align: left; }
            .grid-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; text-align: center; font-size: 10.5px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${
            kopSrc
              ? `<div class="header-kop"><img src="${kopSrc}" alt="Kop Surat Resmi" /></div>`
              : `
            <div class="header-default">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="${activeLogoSrc}" class="header-logo" />
                <div>
                  <div style="font-weight:800; font-size:16px;">${appName}</div>
                  <div style="font-size:10px; color:#059669; font-weight:700;">PANITIA PEMILIHAN SUARA TPS DIGITAL</div>
                </div>
              </div>
              <div style="font-size:10px; font-family:monospace; color:#64748b;">DOKUMEN RESMI REKAPITULASI</div>
            </div>
          `
          }

          <div class="title-box">
            <div class="doc-title">BERITA ACARA REKAPITULASI PERHITUNGAN SUARA</div>
            <div class="doc-num">Nomor: ....................................................</div>
          </div>

          <p style="font-size:11px; line-height:1.5;">
            Pada hari ini <strong>${todayStr}</strong>, telah dilaksanakan perhitungan suara Pemilihan Umum secara digital di <strong>TPS 01 - Wilayah Utama</strong> dengan hasil rekapitulasi sebagai berikut:
          </p>

          <div class="section-title">I. PEROLEHAN SUARA PASANGAN CALON</div>
          <table>
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">NO</th>
                <th>NAMA PASANGAN CALON</th>
                <th style="width:120px; text-align:center;">SUARA SAH</th>
                <th style="width:100px; text-align:center;">PERSENTASE</th>
              </tr>
            </thead>
            <tbody>
              ${candidateRowsHtml}
              <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #0f172a;">
                <td colspan="2" style="padding:8px 12px; border-right:1px solid #0f172a; text-align:right;">TOTAL SUARA SAH MASUK:</td>
                <td style="padding:8px 12px; border-right:1px solid #0f172a; text-align:center; font-family:monospace; color:#047857;">${
                  stats.hasVotedCount
                } Suara</td>
                <td style="padding:8px 12px; text-align:center; font-family:monospace;">100%</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">II. RINCIAN PARTISIPASI PEMILIH</div>
          <div style="border:1px solid #0f172a; border-radius:4px; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; padding:6px 10px; border-bottom:1px solid #cbd5e1; font-size:11px;">
              <span>Total Pemilih Terdaftar (DPT):</span>
              <strong style="font-family:monospace;">${stats.totalVoters} Pemilih</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 10px; border-bottom:1px solid #cbd5e1; font-size:11px;">
              <span>Total Pemilih Menggunakan Hak Pilih:</span>
              <strong style="font-family:monospace; color:#047857;">${stats.hasVotedCount} Pemilih</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 10px; border-bottom:1px solid #cbd5e1; font-size:11px;">
              <span>Total Pemilih Tidak Menggunakan Hak Pilih:</span>
              <strong style="font-family:monospace; color:#64748b;">${Math.max(0, stats.totalVoters - stats.hasVotedCount)} Pemilih</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 10px; background:#f1f5f9; font-weight:bold; font-size:11px;">
              <span>Tingkat Partisipasi Pemilih:</span>
              <strong style="font-family:monospace; color:#7c3aed;">${stats.turnoutPercent}</strong>
            </div>
          </div>

          <p style="font-size:11px; margin-top:16px; line-height:1.5;">
            Demikian Berita Acara Rekapitulasi Perhitungan Suara ini dibuat dengan sebenarnya tanpa ada paksaan dari pihak manapun, untuk dipergunakan sebagaimana mestinya.
          </p>

          <div class="grid-sign">
            <div>
              <div style="font-weight:bold; margin-bottom:8px; text-transform:uppercase; text-align:center;">SAKSI-SAKSI PASLON:</div>
              <div style="display:flex; justify-content:space-around; gap:16px;">
                ${witnessesHtml}
              </div>
            </div>
            <div>
              <div style="font-weight:bold; margin-bottom:8px; text-transform:uppercase; text-align:center;">PANITIA PEMILIHAN TPS:</div>
              <div style="display:flex; flex-direction:column; align-items:center; text-align:center; max-width:220px; margin:0 auto;">
                <div style="height:45px;"></div>
                <div style="border-bottom:1.5px solid #0f172a; padding-bottom:3px; font-weight:bold; font-size:11px; width:100%;">
                  ( ${ketuaName ? ketuaName : 'KETUA KPPS TPS'} )
                </div>
                <span style="font-size:10px; color:#475569; font-weight:600; margin-top:4px; display:block;">Ketua KPPS / Panitia TPS</span>
              </div>
            </div>
          </div>

          <script>
            setTimeout(() => { window.print(); }, 800);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Fetch Pengaturan Nama & Logo & Cek Sesi Admin
  useEffect(() => {
    // 1. Verifikasi Sesi Admin
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.user || data.user.role !== 'ADMIN') {
          router.replace('/');
          return;
        }
      })
      .catch(() => {
        router.replace('/');
      });

    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localSub = localStorage.getItem('app_subtitle');
      const localLogo = localStorage.getItem('app_logo');
      const localKop = localStorage.getItem('app_kop');

      if (localName) setAppName(localName);
      if (localSub) setSubTitle(localSub);
      if (localLogo) setLogoUrl(localLogo);
      if (localKop) setKopUrl(localKop);
    }
  }, [router]);

  // Fetch Statistik & Pengaturan Aplikasi sekaligus secara PARALEL
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/vote/stats'),
      ]);

      const [settingsJson, statsJson] = await Promise.all([
        settingsRes.json(),
        statsRes.json(),
      ]);

      if (settingsJson.success && settingsJson.data) {
        if (settingsJson.data.appName) setAppName(settingsJson.data.appName);
        if (settingsJson.data.subTitle) setSubTitle(settingsJson.data.subTitle);
        if (settingsJson.data.kopUrl) {
          setKopUrl(settingsJson.data.kopUrl);
          if (typeof window !== 'undefined') localStorage.setItem('app_kop', settingsJson.data.kopUrl);
        }
        if (settingsJson.data.logoUrl) {
          setLogoUrl(settingsJson.data.logoUrl);
        } else {
          setLogoUrl('/images/default-logo.png');
        }
      }

      if (statsJson.success && statsJson.data) {
        setStats({
          totalVoters: statsJson.data.totalVoters || 0,
          hasVotedCount: statsJson.data.hasVotedCount || 0,
          turnoutPercent: statsJson.data.turnoutPercent || '0%',
          totalCandidates: Array.isArray(statsJson.data.candidateVotes)
            ? statsJson.data.candidateVotes.length
            : 0,
        });
      }
    } catch (err) {
      console.error('Gagal mengambil data statistik admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    router.push('/');
  };

  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header Admin (Logo & Nama Aplikasi Dinamis - Clean White) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
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
              {appName} - PANEL ADMIN
            </h1>
            <p className="text-xs text-slate-500">{subTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition shadow-sm"
            title="Segarkan Data Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs border border-red-200 transition flex items-center gap-1.5 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* 4 Overview Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-md">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 absolute top-5 right-5">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Hak Pilih</span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {isLoading ? <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600" /> : stats.totalVoters}
            </div>
            <p className="text-xs text-slate-500 mt-1">Pemilih Terdaftar di TPS</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-md">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 absolute top-5 right-5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Suara Masuk</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">
              {isLoading ? <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600" /> : stats.hasVotedCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Sudah Menggunakan Hak Pilih</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-md">
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-600 absolute top-5 right-5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partisipasi Pemilih</span>
            <div className="text-3xl font-black text-purple-600 mt-1">
              {isLoading ? <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600" /> : stats.turnoutPercent}
            </div>
            <p className="text-xs text-slate-500 mt-1">Persentase Pemilih Hadir</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-md">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 absolute top-5 right-5">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paslon</span>
            <div className="text-3xl font-black text-amber-600 mt-1">
              {isLoading ? <LoaderCircle className="w-6 h-6 animate-spin text-emerald-600" /> : stats.totalCandidates}
            </div>
            <p className="text-xs text-slate-500 mt-1">Pasangan Calon Terdaftar</p>
          </div>
        </div>

        {/* Modular Navigation Cards */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-50-[80] text-slate-600">
            Modul Pengelolaan Sistem
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Manajemen Pemilih */}
            <Link
              href="/admin/voters"
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500/50 p-6 rounded-2xl flex flex-col justify-between transition group shadow-md"
            >
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 w-fit">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Manajemen Pemilih & Cetak Kartu
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload Excel data pemilih, tambah manual, dan cetak kartu akses fisik berisi Password Acak TPS.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 mt-6 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                Buka Manajemen Pemilih →
              </span>
            </Link>

            {/* Card 2: Manajemen Paslon */}
            <Link
              href="/admin/candidates"
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500/50 p-6 rounded-2xl flex flex-col justify-between transition group shadow-md"
            >
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 w-fit">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Manajemen Pasangan Calon (Paslon)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tambah, edit, upload foto Ketua & Wakil Ketua, serta atur nomor urut dan visi-misi pasangan calon.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 mt-6 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                Buka Manajemen Paslon →
              </span>
            </Link>

            {/* Card 3: Cetak Berita Acara TPS (Langsung Pop-up Modal) */}
            <button
              type="button"
              onClick={handleOpenBeritaAcaraModal}
              disabled={isOpeningBeritaAcara}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500/50 p-6 rounded-2xl flex flex-col justify-between transition group shadow-md text-left cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 w-fit flex items-center justify-center">
                  {isOpeningBeritaAcara ? (
                    <LoaderCircle className="w-6 h-6 animate-spin text-amber-600" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition flex items-center gap-2">
                  <span>Cetak Berita Acara TPS</span>
                  {isOpeningBeritaAcara && <span className="text-xs text-amber-600 font-normal animate-pulse">(Memuat Data...)</span>}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Generasi dokumen resmi Berita Acara Rekapitulasi Perhitungan Suara TPS lengkap dengan Tanda Tangan Saksi.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 mt-6 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                {isOpeningBeritaAcara ? 'Memuat Data...' : 'Cetak Berita Acara →'}
              </span>
            </button>

            {/* Card 4: Pengaturan Halaman */}
            <Link
              href="/admin/settings"
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500/50 p-6 rounded-2xl flex flex-col justify-between transition group shadow-md"
            >
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-600 w-fit">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Pengaturan Halaman
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ubah nama aplikasi, sub-judul, dan upload logo kustom instansi/kampus untuk Top Bar seluruh halaman.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 mt-6 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                Buka Pengaturan Halaman →
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* MODAL POPUP: INPUT KETUA KPPS & SAKSI SAKSI BERITA ACARA */}
      {isBeritaAcaraModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lengkapi Data Berita Acara TPS
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi nama Ketua KPPS dan Saksi sesuai jumlah paslon terdaftar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBeritaAcaraModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPrintBeritaAcara} className="space-y-4 text-xs">
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
                {candidatesList.map((c) => (
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
                  onClick={() => setIsBeritaAcaraModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>Cetak PDF</span>
                </button>
              </div>
            </form>
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
