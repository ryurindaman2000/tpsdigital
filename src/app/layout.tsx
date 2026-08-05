import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TPS-DIGITAL (Sistem Pemilihan Umum Terenkripsi & Transparan)',
  description: 'Sistem Pemilihan Umum E-Voting Offline/Lokal TPS-DIGITAL',
  icons: {
    icon: '/images/default-logo.png',
    shortcut: '/images/default-logo.png',
    apple: '/images/default-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
