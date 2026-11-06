import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, alarmaId, novedad, comentario, atendidaPor } = body;

    if (mode === 'BATCH_ON_TIME') {
      const res = dataStore.atenderLoteATiempo(atendidaPor || 'Agente Web Batch');
      return NextResponse.json({
        success: true,
        message: `Se atendieron ${res.total} alarmas automáticamente.`,
        atendidas: res.atendidas,
      });
    }

    if (!alarmaId || !novedad) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const resultado = dataStore.atenderAlarma(alarmaId, novedad, comentario || 'En ruta sin novedad alguna', atendidaPor || 'Operador Web');

    if (!resultado) {
      return NextResponse.json({ success: false, error: 'Alarma no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alarma atendida y cerrada exitosamente',
      alarma: resultado,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

