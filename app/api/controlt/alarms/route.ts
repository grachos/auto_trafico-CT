import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prioridad = searchParams.get('prioridad') || 'TODAS';
  const pendientes = searchParams.get('pendientes') !== 'false';

  // 1. Si las credenciales reales de ControlT están presentes, consultar en VIVO
  if (controltClient.isConfigured()) {
    try {
      const liveData = await controltClient.getAlarmsToAttend(100, 1);
      const rawAlarms = liveData?.result || liveData?.data?.records || (Array.isArray(liveData) ? liveData : []);

      if (Array.isArray(rawAlarms) && rawAlarms.length > 0) {
        const alarmasMapeadas = rawAlarms.map((a: any) => {
          let prioridadMapeada: any = 'ALTA';
          const p = String(a.priority || a.priorityName || a.alarm_priority || '').toUpperCase();
          if (p.includes('CRITIC') || p.includes('CRÍTICA')) prioridadMapeada = 'CRITICA';
          else if (p.includes('BAJ')) prioridadMapeada = 'BAJA';
          else if (p.includes('MED')) prioridadMapeada = 'MEDIA';

          const snp = String(a.state_next_point || a.stateNextPoint || '');
          const desc = String(a.description_state_next_point || '').toUpperCase();
          const semaforoEstado = (snp === '1' || desc.includes('A TIEMPO')) ? 'A_TIEMPO' : 'TARDE';

          return {
            id: String(a.id_monitoring_orders_alarm || a.id_monitoring_order_alarm || a.idAlarm || a.id || Math.random()),
            idMonitoringOrdersAlarm: a.id_monitoring_orders_alarm || a.id_monitoring_order_alarm || a.idAlarm,
            prioridad: prioridadMapeada,
            evento: a.alarm_name || a.eventName || a.event || 'LLAMADA DE SEGUIMIENTO',
            nroViaje: a.trip_number || a.tripNumber || a.idTrip || 'N/A',
            placa: a.license_plate || a.vehiclePlate || a.plate || 'N/A',
            conductor: a.driver_name || a.driverName || 'Sin conductor',
            telefono: a.driver_phone || a.driverPhone || '',
            cliente: a.company_customer_name || a.customerName || a.client || 'General',
            fechaHora: a.alarm_date || a.alarmDate || new Date().toLocaleString(),
            ubicacion: a.address || a.current_address_location || a.currentLocation || 'En ruta',
            velocidadKmh: Number(a.speed || 0),
            semaforoETA: semaforoEstado,
            ultimoEventoResumen: a.last_event || a.lastEvent || 'Salida localidad / Tránsito',
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
