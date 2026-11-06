import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool, arguments: args } = body;

    if (!tool) {
      return NextResponse.json({
        tools: [
          'controlt_get_eta_summary',
          'controlt_get_active_alarms',
          'controlt_attend_alarm',
          'controlt_batch_attend_on_time',
          'controlt_get_current_position',
          'controlt_get_binnacle',
          'controlt_get_attended_alarms',
        ],
      });
    }

    switch (tool) {
      case 'controlt_get_eta_summary': {
        const filtro = args?.filtro_semaforo || 'TODOS';
        return NextResponse.json({
          success: true,
          metricas: dataStore.getMetricas(),
          viajes: dataStore.getViajes(filtro),
        });
      }

      case 'controlt_get_active_alarms': {
        const prioridad = args?.prioridad || 'TODAS';
        return NextResponse.json({
          success: true,
          alarmas: dataStore.getAlarmas(prioridad, true),
        });
      }

      case 'controlt_attend_alarm': {
        const { alarmaId, novedad, comentario } = args || {};
        const res = dataStore.atenderAlarma(alarmaId, novedad, comentario, 'HTTP MCP API');
        if (!res) return NextResponse.json({ success: false, error: 'Alarma no encontrada' }, { status: 404 });
        return NextResponse.json({ success: true, alarma: res });
      }

      case 'controlt_batch_attend_on_time': {
        const res = dataStore.atenderLoteATiempo('HTTP MCP API Batch');
        return NextResponse.json({ success: true, total: res.total, atendidas: res.atendidas });
      }

      case 'controlt_get_current_position': {
        const plate = args?.placa || args?.plate;
        if (!plate) return NextResponse.json({ success: false, error: 'Placa requerida' }, { status: 400 });
        const position = controltClient.isConfigured() ? await controltClient.getCurrentPosition(plate) : null;
        return NextResponse.json({ success: true, live: Boolean(position), data: position });
      }

      case 'controlt_get_binnacle': {
        const id = args?.id || args?.idMonitoreo;
        if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
        const binnacle = controltClient.isConfigured() ? await controltClient.getTripBinnacle(id) : null;
        return NextResponse.json({ success: true, live: Boolean(binnacle), data: binnacle });
      }

      case 'controlt_get_attended_alarms': {
        const attended = controltClient.isConfigured() ? await controltClient.getAttendedAlarms() : null;
        return NextResponse.json({ success: true, live: Boolean(attended), data: attended });
      }

      default:
        return NextResponse.json({ success: false, error: `Herramienta desconocida: ${tool}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

