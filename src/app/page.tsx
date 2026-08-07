'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, User, QrCode, ArrowRight, AlertCircle, TrendingUp, Camera, X, RefreshCw, Upload, Eye, EyeOff } from 'lucide-react';

export default function VoterLoginPage() {
  const router = useRouter();
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>('/images/default-logo.png');
  const [bannerUrl, setBannerUrl] = useState<string | null>('/images/default-banner.jpg');

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setSplashFading(true);
    }, 2000);

    const timer2 = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // QR Code Camera Scanner Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch Pengaturan Nama, Logo, & Banner Aplikasi dari LocalStorage & API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem('app_name');
      const localSub = localStorage.getItem('app_subtitle');
      const localLogo = localStorage.getItem('app_logo');
      const localBanner = localStorage.getItem('app_banner');

      if (localName) setAppName(localName);
      if (localSub) setSubTitle(localSub);
      if (localLogo) setLogoUrl(localLogo);
      if (localBanner) setBannerUrl(localBanner);
    }

    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.appName) {
            setAppName(json.data.appName);
            if (typeof window !== 'undefined') localStorage.setItem('app_name', json.data.appName);
          }
          if (json.data.subTitle) {
            setSubTitle(json.data.subTitle);
            if (typeof window !== 'undefined') localStorage.setItem('app_subtitle', json.data.subTitle);
          }
          if (json.data.logoUrl) {
            setLogoUrl(json.data.logoUrl);
            if (typeof window !== 'undefined') localStorage.setItem('app_logo', json.data.logoUrl);
          } else {
            setLogoUrl('/images/default-logo.png');
          }
          if (json.data.bannerUrl) {
            setBannerUrl(json.data.bannerUrl);
            if (typeof window !== 'undefined') localStorage.setItem('app_banner', json.data.bannerUrl);
          } else {
            setBannerUrl('/images/default-banner.jpg');
          }
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Execute Login Helper (Manual Submit / Auto Login dari QR)
  const performLogin = async (loginNim: string, loginPass: string) => {
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nim: loginNim, password: loginPass }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login gagal. Periksa ID Pemilih / Username dan Password.');
      }

      if (data.user) {
        localStorage.setItem('voter_name', data.user.name || '');
        localStorage.setItem('voter_nim', data.user.nim || '');
      }

      if (data.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        const targetName = encodeURIComponent(data.user?.name || '');
        router.push(`/vote?name=${targetName}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  const animFrameRef = useRef<number | null>(null);

  // Process QR Data (dari Kamera atau Galeri Foto HP) & AUTO LOGIN
  const handleQrDataReceived = (dataString: string) => {
    if (!dataString) return;
    stopCamera();
    setIsQrModalOpen(false);

    let detectedNim = '';
    let detectedPass = '';

    const cleanData = dataString.trim();
    try {
      const parsed = JSON.parse(cleanData);
      if (parsed.nim || parsed.id) detectedNim = parsed.nim || parsed.id;
      if (parsed.password || parsed.pass) detectedPass = parsed.password || parsed.pass;
    } catch (e) {
      if (cleanData.includes(':')) {
        const parts = cleanData.split(':');
        detectedNim = parts[0].trim();
        if (parts[1]) detectedPass = parts[1].trim();
      } else if (cleanData.includes('|')) {
        const parts = cleanData.split('|');
        detectedNim = parts[0].trim();
        if (parts[1]) detectedPass = parts[1].trim();
      } else {
        detectedNim = cleanData;
      }
    }

    if (detectedNim) setNim(detectedNim);
    if (detectedPass) setPassword(detectedPass);

    // AUTO LOGIN OTOMATIS JIKA NIM & PASS LENGKAP
    if (detectedNim && detectedPass) {
      performLogin(detectedNim, detectedPass);
    }
  };

  // Real-time Frame Scanner Loop via Browser BarcodeDetector / Canvas Analysis
  const scanVideoFrame = async () => {
    if (!videoRef.current || !streamRef.current) return;

    // 1. Coba browser Native BarcodeDetector (Android Chrome / Edge Super Kencang)
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const qrText = barcodes[0].rawValue;
          if (qrText) {
            handleQrDataReceived(qrText);
            return;
          }
        }
      } catch (err) {
        // Fallback silently jika error
      }
    }

    if (streamRef.current) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  // Start Camera Stream (Mobile Android/iOS & Laptop)
  const startCamera = async () => {
    setCameraError('');
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Browser Anda tidak mendukung akses kamera langsung. Silakan gunakan fitur Unggah Foto QR.');
        setIsScanning(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        // Mulai loop pemindaian real-time 60fps
        animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.error('Izin Kamera Ditolak / Tidak Ditemukan:', err);
      setCameraError(
        'Kamera tidak dapat dibuka. Pastikan Anda telah memberikan izin akses kamera (Allow Camera) pada browser HP/Laptop Anda, atau gunakan pilihan Unggah Foto Kartu Akses di bawah.'
      );
      setIsScanning(false);
    }
  };

  // Stop Camera Stream Cleanup
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  const handleCloseQrModal = () => {
    stopCamera();
    setIsQrModalOpen(false);
  };

  // Handler Upload File Gambar QR Code dari HP/Laptop
  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileNameClean = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
      handleQrDataReceived(fileNameClean);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nim.trim() || !password.trim()) {
      setErrorMsg('ID Pemilih / Username dan Password wajib diisi.');
      return;
    }
    performLogin(nim, password);
  };

  const activeBannerSrc = bannerUrl || '/images/default-banner.jpg';
  const activeLogoSrc = logoUrl || '/images/default-logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between relative overflow-hidden">
      {/* REVAMPED PREMIUM WHITE SPLASH SCREEN WITH ANIMATION */}
      {showSplash && (
        <div
          className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center transition-all duration-700 ease-in-out ${splashFading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
            }`}
        >
          {/* Subtle Ambient Glow Background Orbs */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

          {/* Tampilan Utama Splash Screen: Logo Instansi Tanpa Card di Tengah */}
          <div className="flex flex-col items-center space-y-6 animate-in zoom-in-90 fade-in duration-500 relative z-10 my-auto">
            <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
              <img
                src={activeLogoSrc ? `${activeLogoSrc}?t=${Date.now()}` : '/images/default-logo.png'}
                alt="Logo Instansi"
                className="w-full h-full object-contain drop-shadow-md animate-pulse"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/default-logo.png';
                }}
              />
            </div>

            {/* Judul TPS-Digital */}
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none drop-shadow-sm">
              {appName}
            </h1>

            {/* Premium Animated Loading Bar */}
            <div className="w-44 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/80 shadow-inner">
              <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 h-full w-full animate-pulse rounded-full" />
            </div>
          </div>

          {/* Footer Splash Screen: Gambar splashscreen.png Diperbesar Proposional */}
          <div className="relative z-10 pb-6 pt-2">
            <img
              src="/images/splashscreen.png"
              alt="Powered By Pancakalabs"
              className="h-16 sm:h-20 md:h-24 w-auto object-contain mx-auto opacity-95 transition transform hover:scale-105 drop-shadow-sm"
            />
          </div>
        </div>
      )}

      {/* FULL-WIDTH FIXED TOP BAR HEADER (Tetap Pinned di Atas Saat Scroll) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex justify-between items-center shadow-sm">
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
          {/* Header Actions */}
        </div>
      </header>

      {/* Soft Ambient Background Accents */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[160px] rounded-full pointer-events-none" />

      {/* Main Container Split View Wide Display (Kiri Banner Image Utuh, Kanan Form Login) */}
      <main className="max-w-[95%] lg:max-w-[1400px] mx-auto w-full my-auto z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center p-4 sm:p-6 lg:p-8 pt-24 sm:pt-28 pb-10">

        {/* SISI KIRI: BANNER GAMBAR UTAMA (MELEBAR KANAN KIRI & UTUH TANPA TERPOTONG) */}
        <div className="lg:col-span-7 xl:col-span-8 w-full flex flex-col justify-center">
          <div className="w-full rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white relative group flex items-center justify-center p-2 sm:p-3">
            <img
              src={activeBannerSrc}
              alt="Banner E-Voting TPS"
              loading="lazy"
              decoding="async"
              className="w-full h-auto max-h-[560px] object-contain rounded-2xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* SISI KANAN: FORM LOGIN OTENTIKASI PENGGUNA & ADMIN */}
        <div className="lg:col-span-5 xl:col-span-4 w-full flex flex-col justify-center">

          {/* Form Card White Theme */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                Otentikasi Pemilih
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan ID Pemilih & Password Acak TPS untuk masuk ke bilik suara.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-600 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username / NIM Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ID Pemilih
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    placeholder="Masukkan ID Pemilih Anda"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm transition"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password Field dengan Ikon Mata Intip Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password TPS
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan Password TPS"
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm transition"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition focus:outline-none"
                    title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons Grid: Scan QR Code (Kiri) & Masuk ke Sistem (Kanan) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenQrModal}
                  className="py-3 px-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-2 border-emerald-500/60 text-emerald-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                >
                  <div className="p-1 bg-emerald-600 text-white rounded-lg shadow-sm shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="truncate">Scan QR Code</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    'Memverifikasi...'
                  ) : (
                    <>
                      <span>Masuk ke Sistem</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tombol Memanjang Highlight Jingga/Orange: Real-Time Quick Count di Bawah Form */}
              <div className="pt-2 border-t border-slate-100">
                <Link
                  href="/live-count"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xl shadow-orange-500/25 ring-2 ring-orange-500/30 tracking-wide uppercase group animate-pulse hover:animate-none"
                >
                  <TrendingUp className="w-4.5 h-4.5 text-white transition group-hover:scale-110 shrink-0" />
                  <span>Real-Time Quick Count</span>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* MODAL SCANNER QR CODE PERANGKAT SELULER (ANDROID / IPHONE / LAPTOP) */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal Scanner */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Scan QR Kartu Akses TPS</h3>
                  <p className="text-[11px] text-slate-500">Arahkan kamera HP ke QR Code pada kartu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseQrModal}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewfinder Kamera Live Stream */}
            <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Laser Scanning Grid Overlay */}
              <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/40 rounded-2xl flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-xl animate-pulse flex items-center justify-center bg-emerald-500/5">
                  <span className="text-[10px] font-bold text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/30 shadow">
                    Posisikan QR di Dalam Kotak
                  </span>
                </div>
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Pilihan Opsional: Unggah Foto QR dari Galeri HP / Laptop */}
            <div className="space-y-3">
              <div className="relative text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white px-2">
                  Atau Unggah Gambar QR dari HP
                </span>
              </div>

              <label className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Pilih Foto QR dari Galeri</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseQrModal}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
            >
              Tutup Scanner
            </button>
          </div>
        </div>
      )}

      {/* Footer Security */}
      <footer className="max-w-7xl mx-auto w-full text-center py-4 text-xs text-slate-500 z-10 flex justify-center items-center gap-2 flex-wrap px-6">
        <span>© 2026 Panitia Pemilihan TPS • {appName}</span>
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
