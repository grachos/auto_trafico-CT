import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prioridad = searchParams.get('prioridad') || 'TODAS';
  const pendientes = searchParams.get('pendientes') !== 'false';

  const alarmas = dataStore.getAlarmas(prioridad, pendientes);
  const historial = dataStore.getHistorial();

  return NextResponse.json({
    success: true,
    alarmas,
    historial,
  });
}

