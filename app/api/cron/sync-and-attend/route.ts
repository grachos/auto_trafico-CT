import { NextResponse } from 'next/server';
import { ejecutarCicloMonitoreoInteligente } from '@/lib/monitoring-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Validación de seguridad opcional si se configuró un CRON_SECRET en Vercel
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resultado = await ejecutarCicloMonitoreoInteligente();

    return NextResponse.json({
      success: true,
      message: resultado.pilotoAutomaticoActivo
        ? 'Ciclo de sincronización, piloto automático y monitoreo de seguridad completado.'
        : 'Ciclo de sincronización y monitoreo completado (Piloto automático en modo MANUAL).',
      resultado,
    });
  } catch (error: any) {
    console.error('Error en ejecución del cron sync-and-attend:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
