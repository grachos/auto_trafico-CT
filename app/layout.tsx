import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Torre de Control Inteligente Elogia (ToCIE)',
  description: 'Torre de control de tráfico y monitoreo logístico en tiempo real - Elogia Soluciones Logísticas & ControlT',
  icons: {
    icon: '/logo-elogia.png',
    shortcut: '/favicon.ico',
    apple: '/logo-elogia.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo-elogia.png" type="image/png" />
      </head>
      <body className="min-h-screen bg-[#F7F9F7] text-[#263028] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

