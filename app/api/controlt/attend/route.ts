import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';
import { registrarAuditoriaDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, alarmaId, novedad, comentario, atendidaPor } = body;

    if (mode === 'BATCH_ON_TIME') {
      const res = dataStore.atenderLoteATiempo(atendidaPor || 'Agente Web Batch');

      // Si está configurada la API en vivo, enviar cada una a ControlT
      if (controltClient.isConfigured()) {
        for (const a of res.atendidas) {
          try {
            await controltClient.attendAlarm({
              idAlarm: a.id,
              idNoveltyType: 1, // ID estándar para "En ruta sin novedad alguna"
              description: a.comentarioRegistrado || 'En ruta sin novedad alguna',
            });
          } catch (e: any) {
            console.error(`Error enviando atención de alarma ${a.id} a ControlT en vivo:`, e.message);
          }
        }
      }

      return NextResponse.json({
        success: true,
        live: controltClient.isConfigured(),
        message: `Se atendieron ${res.total} alarmas automáticamente.`,
        atendidas: res.atendidas,
      });
    }

    if (!alarmaId || !novedad) {
      return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Guardar en el store local y auditoría
    const resultado = dataStore.atenderAlarma(alarmaId, novedad, comentario || 'En ruta sin novedad alguna', atendidaPor || 'Operador Web');

    if (!resultado) {
      return NextResponse.json({ success: false, error: 'Alarma no encontrada' }, { status: 404 });
    }

    // 2. Si está configurada la API de ControlT, enviar en VIVO a Tracking/addNovelty
    let controltResponse = null;
    if (controltClient.isConfigured()) {
      try {
        controltResponse = await controltClient.attendAlarm({
          idAlarm: alarmaId,
          idNoveltyType: 1,
          description: comentario || 'En ruta sin novedad alguna',
        });
      } catch (err: any) {
        console.error('Error guardando en ControlT en vivo:', err.message);
      }
    }

    // 3. Registrar en base de datos Supabase
    await registrarAuditoriaDB({
      alarmaId: resultado.id,
      nroViaje: resultado.nroViaje,
      placa: resultado.placa,
      novedad: resultado.novedadAplicada || novedad,
      comentario: resultado.comentarioRegistrado || comentario,
      canalOrigen: 'WEB_APP',
      usuarioOrigen: atendidaPor,
      exitoso: true,
    });

    return NextResponse.json({
      success: true,
      live: controltClient.isConfigured(),
      message: 'Alarma atendida y cerrada exitosamente',
      alarma: resultado,
      controltResponse,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
