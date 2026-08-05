import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TPS-DIGITAL — Sistem E-Voting Terenkripsi & Transparan',
    template: '%s | TPS-DIGITAL',
  },
  description:
    'Sistem E-Voting Modern, Terenkripsi, dan Transparan untuk Pemilihan Umum TPS, Kampus, dan Organisasi. Powered by PancakaLabs.',
  keywords: [
    'TPS Digital',
    'E-Voting',
    'Sistem Pemilihan Umum',
    'Quick Count Real-time',
    'Pemilihan Transparan',
    'PancakaLabs',
  ],
  authors: [{ name: 'PancakaLabs', url: 'https://pancakalabs.my.id' }],
  creator: 'PancakaLabs',
  publisher: 'PancakaLabs',
  icons: {
    icon: '/images/default-logo.png',
    shortcut: '/images/default-logo.png',
    apple: '/images/default-logo.png',
  },
  openGraph: {
    title: 'TPS-DIGITAL — Sistem E-Voting Terenkripsi & Transparan',
    description:
      'Sistem Pemilihan Umum E-Voting Modern dengan Rekapitulasi Quick Count Real-Time, Audit Log Terenkripsi, dan Keamanan Tingkat Tinggi.',
    siteName: 'TPS-DIGITAL E-Voting',
    images: [
      {
        url: '/images/default-banner.jpg',
        width: 1200,
        height: 630,
        alt: 'TPS-DIGITAL E-Voting System Banner',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TPS-DIGITAL — Sistem E-Voting Terenkripsi & Transparan',
    description:
      'Sistem Pemilihan Umum E-Voting Modern dengan Rekapitulasi Quick Count Real-Time & Audit Log Terenkripsi.',
    images: ['/images/default-banner.jpg'],
    creator: '@pancakalabs',
  },
  robots: {
    index: true,
    follow: true,
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
