import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Consigna Privada',
  description: 'App interna para venta a consignación',
  applicationName: 'Consigna Privada',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Consigna Privada',
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
