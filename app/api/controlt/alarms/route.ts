import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prioridad = searchParams.get('prioridad') || 'TODAS';
  const pendientes = searchParams.get('pendientes') !== 'false';

  // 1. Si las credenciales reales de ControlT están presentes, consultar en VIVO
  if (controltClient.isConfigured()) {
    try {
      const liveData = await controltClient.getAlarmsToAttend();
      if (liveData && (liveData.data || Array.isArray(liveData))) {
        const rawAlarms = liveData.data?.records || liveData.data || (Array.isArray(liveData) ? liveData : []);

        const alarmasMapeadas = rawAlarms.map((a: any) => {
          let prioridadMapeada: any = 'ALTA';
          const p = String(a.priorityName || a.priority || '').toUpperCase();
          if (p.includes('CRITIC') || p.includes('CRÍTICA')) prioridadMapeada = 'CRITICA';
          else if (p.includes('BAJ')) prioridadMapeada = 'BAJA';
          else if (p.includes('MED')) prioridadMapeada = 'MEDIA';

          return {
            id: String(a.idAlarm || a.id || Math.random()),
            prioridad: prioridadMapeada,
            evento: a.eventName || a.event || a.alarmName || 'LLAMADA DE SEGUIMIENTO',
            nroViaje: a.tripNumber || a.idTrip || 'N/A',
            placa: a.vehiclePlate || a.plate || 'N/A',
            conductor: a.driverName || 'Sin conductor',
            telefono: a.driverPhone || '',
            cliente: a.customerName || a.client || 'General',
            fechaHora: a.alarmDate || new Date().toLocaleString(),
            ubicacion: a.currentLocation || a.address || 'En ruta',
            velocidadKmh: Number(a.speed || 0),
            semaforoETA: a.stateNextPoint === 1 ? 'A_TIEMPO' : 'TARDE',
            ultimoEventoResumen: a.lastEvent || 'Salida localidad / Tránsito',
            estado: 'PENDIENTE',
          };
        });

        const alarmasFiltradas = prioridad === 'TODAS'
          ? alarmasMapeadas
          : alarmasMapeadas.filter((a: any) => a.prioridad === prioridad);

        return NextResponse.json({
          success: true,
          live: true,
          alarmas: alarmasFiltradas,
          historial: dataStore.getHistorial(),
        });
      }
    } catch (err: any) {
      console.warn('Error llamando alarmas en vivo ControlT, usando fallback:', err.message);
    }
  }

  // 2. Fallback con datos iniciales
  const alarmas = dataStore.getAlarmas(prioridad, pendientes);
  const historial = dataStore.getHistorial();

  return NextResponse.json({
    success: true,
    live: false,
    alarmas,
    historial,
  });
}
