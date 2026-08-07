'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LoaderCircle,
  Vote,
  X,
  Image as ImageIcon,
  UserCog,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SettingsAdminPage() {
  const [appName, setAppName] = useState('TPS-DIGITAL');
  const [subTitle, setSubTitle] = useState('Sistem E-Voting Terenkripsi & Transparan');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [kopUrl, setKopUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // State Pengaturan Akun Admin
  const [currentAdminUsername, setCurrentAdminUsername] = useState('admin');
  const [newAdminUsername, setNewAdminUsername] = useState('admin');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');
  const [adminErrorMsg, setAdminErrorMsg] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Premium Image Dimension Error Modal State
  const [imageErrorModal, setImageErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detectedSize: string;
    recommendation: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const kopInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch Pengaturan Aplikasi dari API + LocalStorage Fallback
  const fetchSettings = async () => {
    setIsLoading(true);

    // Read localStorage first for instant UI response
    if (typeof window !== 'undefined') {
      const localKop = localStorage.getItem('app_kop');
      if (localKop) setKopUrl(localKop);
      const localLogo = localStorage.getItem('app_logo');
      if (localLogo) setLogoUrl(localLogo);
      const localBanner = localStorage.getItem('app_banner');
      if (localBanner) setBannerUrl(localBanner);
    }

    try {
      // Fetch pengaturan dan data akun admin secara PARALEL (2x lebih cepat)
      const [res, adminRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/admin/account'),
      ]);

      const [json, adminJson] = await Promise.all([
        res.json(),
        adminRes.json(),
      ]);

      if (json.success && json.data) {
        if (json.data.appName) setAppName(json.data.appName);
        if (json.data.subTitle) setSubTitle(json.data.subTitle);
        if (json.data.logoUrl) setLogoUrl(json.data.logoUrl);
        if (json.data.bannerUrl) setBannerUrl(json.data.bannerUrl);
        if (json.data.kopUrl) {
          setKopUrl(json.data.kopUrl);
          if (typeof window !== 'undefined') localStorage.setItem('app_kop', json.data.kopUrl);
        }
      }

      if (adminJson.success && adminJson.username) {
        setCurrentAdminUsername(adminJson.username);
        setNewAdminUsername(adminJson.username);
      }
    } catch (err) {
      console.error('Gagal mengambil pengaturan aplikasi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Simpan Pengaturan Akun Admin
  const handleSaveAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSuccessMsg('');
    setAdminErrorMsg('');

    if (!currentAdminPassword) {
      setAdminErrorMsg('Password saat ini wajib diisi untuk konfirmasi keamanan.');
      return;
    }

    if (!newAdminUsername.trim()) {
      setAdminErrorMsg('Username admin baru tidak boleh kosong.');
      return;
    }

    if (newAdminPassword && newAdminPassword !== confirmAdminPassword) {
      setAdminErrorMsg('Konfirmasi password baru tidak cocok dengan password baru.');
      return;
    }

    setIsAdminSubmitting(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPassword,
          newUsername: newAdminUsername.trim(),
          newPassword: newAdminPassword ? newAdminPassword.trim() : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setAdminErrorMsg(json.message || 'Gagal mengubah akun admin.');
        return;
      }

      setAdminSuccessMsg(json.message || 'Akun admin berhasil diperbarui!');
      if (json.username) {
        setCurrentAdminUsername(json.username);
        setNewAdminUsername(json.username);
      }
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } catch (err) {
      console.error(err);
      setAdminErrorMsg('Terjadi kesalahan jaringan/server.');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Handler Upload File Logo -> Base64 (Validasi Wajib Square / Presisi 1:1)
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width !== img.height) {
            setImageErrorModal({
              isOpen: true,
              title: 'Format Logo Ditolak',
              message: 'Ukuran logo yang Anda unggah bukan berorientasi Persegi / Square (1:1). Logo wajib memiliki rasio 1:1 agar tampil simetris di Top Bar.',
              detectedSize: `${img.width} x ${img.height} px`,
              recommendation: 'Gunakan gambar berorientasi Persegi / Square (1:1), seperti 512 x 512 px atau 800 x 800 px.',
            });
            if (logoInputRef.current) logoInputRef.current.value = '';
            return;
          }
          setErrorMsg('');
          setLogoUrl(base64Data);
        };
        img.src = base64Data;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Upload File Banner -> Base64 (Validasi Wajib Landscape / Horizontal)
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width <= img.height) {
            setImageErrorModal({
              isOpen: true,
              title: 'Format Banner Ditolak',
              message: 'Gambar banner yang Anda unggah bukan berorientasi Horizontal / Landscape (16:9). Banner wajib berorientasi mendatar (lebar > tinggi).',
              detectedSize: `${img.width} x ${img.height} px`,
              recommendation: 'Gunakan gambar Landscape 16:9 berukuran 1920 x 1080 px (Full HD) atau minimal 1280 x 720 px (HD).',
            });
            if (bannerInputRef.current) bannerInputRef.current.value = '';
            return;
          }
          setErrorMsg('');
          setBannerUrl(base64Data);
        };
        img.src = base64Data;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Upload File Kop Surat -> Base64 (Validasi Wajib Landscape Mendatar / Wide Ratio)
  const handleKopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Kop Surat wajib berorientasi Landscape Mendatar Lebar (minimal 2x lebih lebar daripada tingginya)
          if (img.width < img.height * 1.8) {
            setImageErrorModal({
              isOpen: true,
              title: 'Format Kop Surat Ditolak',
              message:
                'Gambar Kop Surat wajib berorientasi Horizontal / Landscape Mendatar (lebar minimal 2x dari tinggi). Gambar yang Anda unggah tidak berformat Landscape Kop Surat.',
              detectedSize: `${img.width} x ${img.height} px`,
              recommendation:
                'Gunakan gambar Kop Surat Landscape Mendatar (lebar kesamping), misalnya 1200 x 250 px atau 1920 x 300 px.',
            });
            if (kopInputRef.current) kopInputRef.current.value = '';
            return;
          }
          setErrorMsg('');
          setKopUrl(base64Data);
        };
        img.src = base64Data;
      };
      reader.readAsDataURL(file);
    }
  };

  // Simpan Pengaturan ke API + LocalStorage
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!appName.trim()) {
      setErrorMsg('Nama aplikasi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: appName.trim(),
          subTitle: subTitle.trim(),
          logoUrl,
          bannerUrl,
          kopUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.message || 'Gagal menyimpan pengaturan aplikasi.');
        setIsSubmitting(false);
        return;
      }

      // Simpan ke LocalStorage agar langsung sinkron tanpa refresh
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_name', appName.trim());
        localStorage.setItem('app_subtitle', subTitle.trim());
        if (logoUrl) localStorage.setItem('app_logo', logoUrl);
        if (bannerUrl) localStorage.setItem('app_banner', bannerUrl);
        if (kopUrl) localStorage.setItem('app_kop', kopUrl);
      }

      setSuccessMsg('Pengaturan nama aplikasi, logo, banner, dan kop surat berhasil disimpan!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan jaringan/server.');
    } finally {
      setIsSubmitting(false);
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
            {appName} - Pengaturan Halaman
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Action Bar / Tombol Kembali ke Dashboard */}
        <div className="flex justify-between items-center">
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-200 shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-slate-500 shadow-md">
            <LoaderCircle className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-medium">Memuat pengaturan aplikasi...</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-6 text-slate-900">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                Konfigurasi Identitas Aplikasi E-Voting
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ubah Nama Aplikasi, Sub-Judul, Logo, dan Banner Sisi Kiri Halaman Login secara instan.
              </p>
            </div>

            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Nama Aplikasi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Judul di Top bar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: E-VOTINGKU SYSTEM"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              {/* Sub-Judul Aplikasi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sub Judul
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sistem E-Voting Terenkripsi & Transparan"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              {/* Upload Logo Aplikasi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Unggah Logo</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Wajib Berrasio Persegi / Square 1:1, contoh: 512x512px)
                  </span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={logoInputRef}
                  onChange={handleLogoChange}
                  className="hidden"
                />

                {logoUrl ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center p-1 shadow-sm">
                        <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-600 block">Logo Dipilih</span>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          Ganti Logo
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-200 rounded-xl transition"
                      title="Reset Logo"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-emerald-600 rounded-xl transition flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-2.5 bg-white group-hover:bg-emerald-50 rounded-xl text-slate-400 group-hover:text-emerald-600 border border-slate-200 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold text-slate-700 block">
                        Upload Logo Kustom (.png, .jpg, .svg)
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* UPLOAD GAMBAR BANNER HALAMAN LOGIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Gambar Banner Sisi Kiri Halaman Login</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Wajib Landscape 16:9, Rekomendasi: 1920x1080px / 1280x720px)
                  </span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={bannerInputRef}
                  onChange={handleBannerChange}
                  className="hidden"
                />

                {bannerUrl ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="w-full h-40 bg-white rounded-xl overflow-hidden border border-slate-200 relative shadow-sm">
                      <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setBannerUrl(null)}
                        className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-red-600 text-white rounded-xl backdrop-blur-md transition"
                        title="Hapus Banner Custom"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-600 font-bold">Gambar Banner Custom Dipilih</span>
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Ganti Gambar Banner
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="w-full py-6 px-4 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-emerald-600 rounded-xl transition flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-3 bg-white group-hover:bg-emerald-50 rounded-2xl text-slate-400 group-hover:text-emerald-600 border border-slate-200 transition">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold text-slate-700 block">
                        Upload Gambar Banner Kustom Halaman Login (.png, .jpg, .svg)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Akan langsung tampil di Sisi Kiri Halaman Login Pemilih
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* UPLOAD GAMBAR KOP SURAT */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Gambar Kop Surat Resmi TPS</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Wajib Landscape Mendatar, Rekomendasi: 1200x250px)
                  </span>
                </label>
                <input
                  type="file"
                  ref={kopInputRef}
                  onChange={handleKopChange}
                  accept="image/*"
                  className="hidden"
                />

                {kopUrl ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="w-full h-24 bg-white rounded-xl overflow-hidden border border-slate-200 relative shadow-sm flex items-center justify-center p-2">
                      <img src={kopUrl} alt="Kop Surat Preview" className="max-h-full max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setKopUrl(null);
                          if (typeof window !== 'undefined') localStorage.removeItem('app_kop');
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-xl backdrop-blur-md transition"
                        title="Hapus Kop Surat Custom"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-600 font-bold">Gambar Kop Surat Dipilih</span>
                      <button
                        type="button"
                        onClick={() => kopInputRef.current?.click()}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Ganti Gambar Kop Surat
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => kopInputRef.current?.click()}
                    className="w-full py-5 px-4 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-emerald-600 rounded-xl transition flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-2.5 bg-white group-hover:bg-emerald-50 rounded-2xl text-slate-400 group-hover:text-emerald-600 border border-slate-200 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold text-slate-700 block">
                        Upload Gambar Kop Surat Resmi (.png, .jpg, .svg)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Akan tampil pada Cetak Kartu Akses PDF & Dokumen Berita Acara TPS
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* Preview Live Header Top Bar */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  Pratinjau Top Bar Header (Live Preview):
                </label>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeLogoSrc}
                      alt="Logo"
                      className="h-10 w-auto object-contain shrink-0"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{appName || 'E-VOTINGKU SYSTEM'}</h3>
                      <p className="text-[11px] text-slate-500">{subTitle || 'Sistem E-Voting Terenkripsi & Transparan'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan Aplikasi'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Pengaturan Kredensial Akun Admin */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-6 text-slate-900">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-emerald-600" />
                Pengaturan Kredensial Akun Admin
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ubah Username dan Password Admin yang digunakan untuk login ke Panel Admin TPS.
              </p>
            </div>

            {adminSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{adminSuccessMsg}</span>
              </div>
            )}

            {adminErrorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{adminErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdminAccount} className="space-y-5">
              {/* Badge Informative Username Admin Aktif */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Username Admin Aktif Saat Ini:</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200">
                  {currentAdminUsername}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username Baru */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username Admin Baru <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: admin / kpps_utama"
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition font-medium"
                  />
                </div>

                {/* Password Saat Ini (Wajib Konfirmasi) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password saat ini <span className="text-red-500">*</span> (Wajib diisi untuk konfirmasi)
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      placeholder="Masukkan password admin saat ini"
                      value={currentAdminPassword}
                      onChange={(e) => setCurrentAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition font-medium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Baru */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password Admin Baru <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Masukkan password baru"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition font-medium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Konfirmasi Password Baru */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Konfirmasi Password Admin Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Ulangi password baru"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition font-medium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isAdminSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isAdminSubmitting ? 'Memperbarui...' : 'Perbarui Kredensial Admin'}</span>
                </button>
              </div>
            </form>
          </div>
          </>
        )}
      </main>

      {/* MODAL POPUP PREMIUM: Penolakan Ukuran Gambar Tidak Sesuai */}
      {imageErrorModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Ambient Red/Amber Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-600 shadow-inner">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {imageErrorModal.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {imageErrorModal.message}
              </p>
            </div>

            {/* Information Badges */}
            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Dimensi Terdeteksi:</span>
                <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {imageErrorModal.detectedSize}
                </span>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl space-y-1 text-left">
                <span className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider block">
                  💡 Rekomendasi Ukuran Ideal:
                </span>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  {imageErrorModal.recommendation}
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => setImageErrorModal(null)}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2"
            >
              <span>Mengerti, Pilih Gambar Lain</span>
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
