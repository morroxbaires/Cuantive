import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Cuantive — Operational Intelligence para tu flota',
    template: '%s | Cuantive',
  },
  description:
    'Plataforma SaaS de gestión inteligente de flotas. Control de vehículos, conductores, combustible y mantenimiento con analítica en tiempo real. Diseñado para empresas en Uruguay.',
  keywords: [
    'gestión de flotas', 'control de vehículos', 'combustible flota',
    'mantenimiento vehicular', 'SaaS Uruguay', 'operational intelligence',
    'fleet management', 'analítica de flota',
  ],
  authors: [{ name: 'Cuantive', url: 'https://cuantive.com' }],
  creator: 'Cuantive',
  metadataBase: new URL('https://cuantive.com'),
  openGraph: {
    type:        'website',
    locale:      'es_UY',
    url:         'https://cuantive.com',
    title:       'Cuantive — Operational Intelligence',
    description: 'Gestión inteligente de flotas empresariales. Analítica, alertas y control total desde un dashboard.',
    siteName:    'Cuantive',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Cuantive — Operational Intelligence',
    description: 'Gestión inteligente de flotas empresariales.',
    creator:     '@cuantive',
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  themeColor: '#0A1628',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-slate-50 font-sans antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
