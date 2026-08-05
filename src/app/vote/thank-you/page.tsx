'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ThankYouPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl space-y-6">
        <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Terima Kasih!</h1>
          <p className="text-sm text-slate-400 mt-2">
            Suara Anda telah berhasil tercatat secara <strong className="text-emerald-400">anonim</strong> ke dalam sistem database TPS.
          </p>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Sesi login Anda telah terkunci secara otomatis.</span>
        </div>

        <div className="pt-2 text-xs text-slate-500">
          Mengembalikan layar ke halaman login dalam{' '}
          <span className="font-bold text-emerald-400 text-sm">{countdown}</span> detik...
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition"
        >
          Selesai / Keluar Sekarang
        </button>
      </div>
    </div>
  );
}
