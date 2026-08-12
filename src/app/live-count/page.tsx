'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Vote, TrendingUp, RefreshCw, CheckCircle2, ShieldCheck, ArrowRight, User } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CandidateVote {
  id: number;
  candidateNumber: number;
  chairmanName: string;
  viceChairmanName: string;
  name: string;
  chairmanPhoto?: string | null;
  viceChairmanPhoto?: string | null;
  photoUrl?: string | null;
  voteCount: number;
  percentage: number;
}

export default function LiveCountPage() {
  const router = useRouter();
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');

  const [stats, setStats] = useState({
    totalVoters: 0,
    hasVotedCount: 0,
    turnoutPercent: '0%',
    abstainCount: 0,
  });

  const [candidateVotes, setCandidateVotes] = useState<CandidateVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Fetch Pengaturan & Data Live Count sekaligus secara PARALEL
  const fetchLiveStats = async () => {
    try {
      const [settingsRes, statsRes, candidatesRes] = await Promise.all([
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/vote/stats', { cache: 'no-store' }),
        fetch('/api/candidates', { cache: 'no-store' }),
      ]);

      const [settingsJson, json, candidatesJson] = await Promise.all([
        settingsRes.json(),
        statsRes.json(),
        candidatesRes.json(),
      ]);

      const candidatesMap: Record<string, any> = {};
      if (candidatesJson.success && Array.isArray(candidatesJson.data)) {
        candidatesJson.data.forEach((c: any) => {
          candidatesMap[String(c.candidateNumber)] = c;
          candidatesMap[String(c.id)] = c;
        });
      }

      if (settingsJson.success && settingsJson.data) {
        if (settingsJson.data.appName) {
          setAppName(settingsJson.data.appName);
          if (typeof window !== 'undefined') localStorage.setItem('app_name', settingsJson.data.appName);
        }
        if (settingsJson.data.subTitle) {
          setSubTitle(settingsJson.data.subTitle);
          if (typeof window !== 'undefined') localStorage.setItem('app_subtitle', settingsJson.data.subTitle);
        }
        if (settingsJson.data.logoUrl) {
          setLogoUrl(settingsJson.data.logoUrl);
          if (typeof window !== 'undefined') localStorage.setItem('app_logo', settingsJson.data.logoUrl);
        } else {
          setLogoUrl('/images/default-logo.png');
        }
      }

      if (json.success && json.data) {
        const newStats = {
          totalVoters: json.data.totalVoters || 0,
          hasVotedCount: json.data.hasVotedCount || 0,
          turnoutPercent: json.data.turnoutPercent || '0%',
          abstainCount: json.data.abstainCount || 0,
        };

        const rawCands = Array.isArray(json.data.candidateVotes) ? json.data.candidateVotes : [];
        const enrichedCands = rawCands.map((c: any) => {
          const detail = candidatesMap[String(c.candidateNumber)] || candidatesMap[String(c.id)] || {};
          return {
            ...c,
            chairmanPhoto: c.chairmanPhoto || detail.chairmanPhoto || detail.photoUrl,
            viceChairmanPhoto: c.viceChairmanPhoto || detail.viceChairmanPhoto,
            photoUrl: c.photoUrl || detail.photoUrl || detail.chairmanPhoto,
            chairmanName: c.chairmanName || detail.chairmanName,
            viceChairmanName: c.viceChairmanName || detail.viceChairmanName,
          };
        });

        if (enrichedCands.length > 0) {
          setStats(newStats);
          setCandidateVotes(enrichedCands);
        } else {
          // Fallback: Ambil dokumen stats/summary via Firebase Web SDK Client Browser (Hemat Quota)
          try {
            const { doc: fsDoc, getDoc } = await import('firebase/firestore');
            const { db: fdb } = await import('@/lib/firebase');

            const summarySnap = await getDoc(fsDoc(fdb, 'stats', 'summary'));
            if (summarySnap.exists()) {
              const data = summarySnap.data();
              if (data.candidateVotesJson) {
                const cands = JSON.parse(data.candidateVotesJson);
                const enrichedFallback = cands.map((c: any) => {
                  const detail = candidatesMap[String(c.candidateNumber)] || candidatesMap[String(c.id)] || {};
                  return {
                    ...c,
                    chairmanPhoto: c.chairmanPhoto || detail.chairmanPhoto || detail.photoUrl,
                    viceChairmanPhoto: c.viceChairmanPhoto || detail.viceChairmanPhoto,
                    photoUrl: c.photoUrl || detail.photoUrl || detail.chairmanPhoto,
                    chairmanName: c.chairmanName || detail.chairmanName,
                    viceChairmanName: c.viceChairmanName || detail.viceChairmanName,
                  };
                });
                setCandidateVotes(enrichedFallback);
                setStats({
                  totalVoters: Number(data.totalVoters) || 0,
                  hasVotedCount: Number(data.hasVotedCount) || 0,
                  turnoutPercent: data.turnoutPercent || '0%',
                  abstainCount: 0,
                });
              } else {
                setStats(newStats);
              }
            } else {
              setStats(newStats);
            }
          } catch (clientFsErr) {
            console.warn('[LiveCount Client SDK Fallback Error]:', clientFsErr);
            setStats(newStats);
          }
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'live_stats_cache',
            JSON.stringify({
              stats: newStats,
              candidateVotes: json.data.candidateVotes || [],
            })
          );
        }

        const now = new Date();
        setLastUpdated(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Gagal mengambil data live count:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // PROTEKSI HALAMAN QUICK COUNT: WAJIB LOGIN SEBAGAI ADMIN
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
      const localLiveStats = localStorage.getItem('live_stats_cache');

      if (localName) setAppName(localName);
      if (localSub) setSubTitle(localSub);
      if (localLogo) setLogoUrl(localLogo);
      if (localLiveStats) {
        try {
          const parsed = JSON.parse(localLiveStats);
          if (parsed.stats) setStats(parsed.stats);
          if (parsed.candidateVotes) setCandidateVotes(parsed.candidateVotes);
        } catch { }
      }
    }

    // 1. Fetch awal
    fetchLiveStats();

    // 2. Real-time Firebase Firestore Listener Hemat Quota
    // Menggunakan debounce agar saat terjadi pencoblosan bersamaan, fetch tidak dipanggil berkali-kali secara eksplosif
    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerDebouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLiveStats();
      }, 800); // Wait 800ms sebelum fetch ulang
    };

    let unsubVotes: (() => void) | null = null;

    try {
      // Listen HANYA ke 1 dokumen 'stats/summary' (Sangat Hemat Quota Reads!)
      unsubVotes = onSnapshot(doc(db, 'stats', 'summary'), () => {
        triggerDebouncedFetch();
      });
    } catch (e) {
      console.warn('[LiveCount Realtime Listener Error]:', e);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unsubVotes) unsubVotes();
    };
  }, []);

  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* FULL-WIDTH STICKY TOP BAR HEADER (Clean White Theme) */}
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
              {appName}
            </h1>
            <p className="text-xs text-slate-500">{subTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs border border-emerald-200 transition shadow-sm"
          >
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Stats Body */}
      <main className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* Title Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex justify-between items-center flex-wrap gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">MONITOR QUICK COUNT REAL-TIME</h2>
              <p className="text-xs text-slate-500">Hasil Perolehan Suara Transparan</p>
            </div>
          </div>
          {lastUpdated && (
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              Terakhir Diperbarui: {lastUpdated}
            </span>
          )}
        </div>

        {/* 3 Cards Summary (Presisi Tanpa Suara Kosong/Abstain) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Hak Pilih</span>
            <div className="text-3xl font-black text-slate-900">{stats.totalVoters}</div>
            <p className="text-xs text-slate-500">Pemilih Terdaftar di TPS</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Suara Masuk</span>
            <div className="text-3xl font-black text-emerald-600">{stats.hasVotedCount}</div>
            <p className="text-xs text-slate-500">Terdaftar Resmi di TPS</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2 shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partisipasi Pemilih</span>
            <div className="text-3xl font-black text-purple-600">{stats.turnoutPercent}</div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 mt-1">
              <div
                className="bg-purple-600 h-full transition-all duration-700 rounded-full"
                style={{ width: stats.turnoutPercent }}
              />
            </div>
          </div>
        </div>

        {/* Perolehan Suara Paslon List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Perolehan Suara Pasangan Calon
            </h3>
            <span className="text-xs text-slate-500">Kalkulasi Otomatis Transparan</span>
          </div>

          {candidateVotes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-2xl">
              Belum ada data suara masuk atau paslon belum ditambahkan oleh Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {candidateVotes.map((paslon) => {
                const displayName = paslon.chairmanName && paslon.viceChairmanName
                  ? `${paslon.chairmanName} & ${paslon.viceChairmanName}`
                  : paslon.chairmanName || paslon.name || `Paslon 0${paslon.candidateNumber}`;

                return (
                  <div
                    key={paslon.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition"
                  >
                    {/* Header Badge Paslon */}
                    <div className="flex flex-col items-center text-center border-b border-slate-200/80 pb-3 gap-1.5 w-full overflow-hidden">
                      <span className="px-3.5 py-1 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-sm tracking-wide">
                        PASLON 0{paslon.candidateNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug break-words break-all max-w-full">
                        {displayName}
                      </h4>
                    </div>

                    {/* Foto Pasangan Ketua & Wakil Calon */}
                    <div className="flex items-center justify-center gap-3 py-1">
                      {/* Foto Ketua Calon */}
                      <div className="flex flex-col items-center text-center max-w-[110px]">
                        <div className="w-20 h-24 bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-1 relative">
                          {paslon.chairmanPhoto || paslon.photoUrl ? (
                            <img
                              src={paslon.chairmanPhoto || paslon.photoUrl!}
                              alt={paslon.chairmanName || 'Calon Ketua'}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                              <User className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">
                          Calon Ketua
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-tight break-words break-all max-w-full">
                          {paslon.chairmanName || `Paslon 0${paslon.candidateNumber}`}
                        </span>
                      </div>

                      {/* Foto Wakil Calon */}
                      {(paslon.viceChairmanPhoto || paslon.viceChairmanName) && (
                        <div className="flex flex-col items-center text-center max-w-[110px]">
                          <div className="w-20 h-24 bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-1 relative">
                            {paslon.viceChairmanPhoto ? (
                              <img
                                src={paslon.viceChairmanPhoto}
                                alt={paslon.viceChairmanName || 'Calon Wakil'}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                <User className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">
                            Calon Wakil
                          </span>
                          <span className="text-xs font-bold text-slate-800 leading-tight break-words break-all max-w-full">
                            {paslon.viceChairmanName || '-'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stats Section: Persentase & Jumlah Suara */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      {/* Card Persentase Suara */}
                      <div className="bg-white border border-slate-200 p-3 rounded-xl text-center flex flex-col justify-center space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Persentase
                        </span>
                        <div className="text-xl font-black text-purple-600 font-mono leading-none">
                          {paslon.percentage}%
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200 mt-1">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all duration-700"
                            style={{ width: `${paslon.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Card Jumlah Suara Masuk */}
                      <div className="bg-white border border-slate-200 p-3 rounded-xl text-center flex flex-col justify-center space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Suara Masuk
                        </span>
                        <div className="text-xl font-black text-emerald-600 font-mono leading-none">
                          {paslon.voteCount}
                        </div>
                        <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 w-fit mx-auto">
                          Suara Sah
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer Security */}
      <footer className="max-w-7xl mx-auto w-full text-center py-6 text-xs text-slate-500 flex justify-center items-center px-6 border-t border-slate-200/60 mt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            Monitor Publik TPS E-Voting • Powered by{' '}
            <a
              href="https://pancakalabs.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-emerald-600 hover:underline"
            >
              Pancakalabs
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
