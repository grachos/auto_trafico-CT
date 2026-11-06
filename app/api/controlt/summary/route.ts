import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const semaforo = searchParams.get('semaforo') || 'TODOS';

  const metricas = dataStore.getMetricas();
  const viajes = dataStore.getViajes(semaforo);

  return NextResponse.json({
    success: true,
    metricas,
    viajes,
  });
}

