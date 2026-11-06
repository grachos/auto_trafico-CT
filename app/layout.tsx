import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Torre de Control ControlT - Agente Autónomo',
  description: 'Gestión inteligente de tráfico, semáforo ETA y atención autónoma de alarmas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

