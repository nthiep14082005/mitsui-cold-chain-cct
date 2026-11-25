import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CctProvider } from '@/components/layout/CctContext';

export const metadata: Metadata = {
  title: 'Mitsui Cold Chain Control Tower (CCT)',
  description:
    'Hệ thống điều phối chuỗi lạnh rau củ quả Mitsui trên hành lang ĐBSCL – Bến Lức – TP.HCM',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <CctProvider>{children}</CctProvider>
      </body>
    </html>
  );
}
