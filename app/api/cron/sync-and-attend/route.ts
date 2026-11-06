import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { getMySqlPool, registrarAuditoriaDB } from '@/lib/db';
import { telegramService } from '@/lib/telegram-service';
import { dataStore } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Validación de seguridad opcional si se configuró un CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    syncedViajes: 0,
    syncedAlarmas: 0,
    atendidasAutomaticamente: 0,
    alarmasCriticasDetectadas: 0,
    detalles: [],
  };

  const pool = getMySqlPool();

  try {
    // 1. Sincronizar Viajes en Vivo desde ControlT
    if (controltClient.isConfigured()) {
      const liveTripsData = await controltClient.getSummaryTrips(200, 1);
      const rawTrips = liveTripsData?.result || liveTripsData?.data?.records || [];
      result.syncedViajes = rawTrips.length;

      if (pool && Array.isArray(rawTrips) && rawTrips.length > 0) {
        for (const r of rawTrips) {
          try {
            const snp = String(r.state_next_point || r.stateNextPoint || '');
            const desc = String(r.description_state_next_point || '').toUpperCase();

            let semaforo = 'SIN_CALCULO';
            if (snp === '1' || desc.includes('A TIEMPO')) semaforo = 'A_TIEMPO';
            else if (snp === '3' || desc.includes('TARDE') || desc.includes('RETRAS')) semaforo = 'TARDE';
            else if (snp === '2' || desc.includes('TOLERANCIA')) semaforo = 'TOLERANCIA';

            await pool.execute(
              `INSERT INTO viajes 
               (id, nro_viaje, placa, conductor, cliente, origen, destino, semaforo_eta, porcentaje_ruta, velocidad_kmh, ubicacion, ultimo_evento)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
               semaforo_eta = VALUES(semaforo_eta),
               porcentaje_ruta = VALUES(porcentaje_ruta),
               velocidad_kmh = VALUES(velocidad_kmh),
               ubicacion = VALUES(ubicacion),
               ultimo_evento = VALUES(ultimo_evento)`,
              [
                String(r.id_monitoring_order || r.idTrip || Math.random()),
                String(r.trip_number || r.tripNumber || r.idTrip || 'N/A'),
                String(r.license_plate || r.vehiclePlate || 'N/A'),
                String(r.driver_name || r.driverName || 'Sin conductor'),
                String(r.company_customer_name || r.customerName || 'General'),
                String(r.origin_city_name || r.origin || 'Origen'),
                String(r.destiny_city_name || r.destination || 'Destino'),
                semaforo,
                Number(r.percentage_travel || r.routePercentage || 0),
                Number(r.speed || 0),
                String(r.current_address_location || r.currentLocation || 'En ruta'),
                String(r.last_event || r.lastEvent || 'Tránsito'),
              ]
            );
          } catch (e: any) {
            console.warn(`Error guardando viaje ${r.trip_number || r.tripNumber} en MySQL:`, e.message);
          }
        }
      }

      // 2. Sincronizar Alarmas en Vivo desde ControlT
      const liveAlarmsData = await controltClient.getAlarmsToAttend(100, 1);
      const rawAlarms = liveAlarmsData?.result || liveAlarmsData?.data?.records || (Array.isArray(liveAlarmsData) ? liveAlarmsData : []);
      result.syncedAlarmas = rawAlarms.length;

      // Detectar alarmas críticas para notificación
      const criticas = rawAlarms.filter((a: any) => {
        const p = String(a.priority || a.priorityName || '').toUpperCase();
        const ev = String(a.alarm_name || a.eventName || '').toUpperCase();
        return p.includes('CRITIC') || ev.includes('FUERA DE RUTA');
      });
      result.alarmasCriticasDetectadas = criticas.length;

      // 3. Proceso Autónomo: Atender llamadas de seguimiento de viajes a tiempo
      const candidatas = rawAlarms.filter((a: any) => {
        const snp = String(a.state_next_point || a.stateNextPoint || '');
        const desc = String(a.description_state_next_point || '').toUpperCase();
        const ev = String(a.alarm_name || a.eventName || a.event || '').toUpperCase();
        const isATiempo = snp === '1' || desc.includes('A TIEMPO');
        const isSeguimiento = ev.includes('LLAMADA DE SEGUIMIENTO') || ev.includes('SEGUIMIENTO');
        return isATiempo && isSeguimiento;
      });

      for (const c of candidatas) {
        try {
          const alarmId = c.id_monitoring_orders_alarm || c.id_monitoring_order_alarm || c.idAlarm || c.id;
          const tripNum = String(c.trip_number || c.tripNumber || 'N/A');
          const plate = String(c.license_plate || c.vehiclePlate || 'N/A');
          const speed = c.speed || 0;
          const address = c.address || c.current_address_location || 'En ruta';
          const comment = `Vehículo en movimiento a ${speed} km/h en ${address}. Ruta sin novedad alguna.`;

          await controltClient.attendAlarm({
            idMonitoringOrdersAlarm: alarmId,
            numberTrip: tripNum,
            licensePlate: plate,
            noveltySelected: 1, // "En ruta sin novedad alguna"
            codeNoveltySelected: 'EN_RUTA',
            comment,
            address,
          });

          await registrarAuditoriaDB({
            alarmaId: String(alarmId),
            nroViaje: tripNum,
            placa: plate,
            novedad: 'En ruta sin novedad alguna',
            comentario: comment,
            canalOrigen: 'PILOTO_AUTOMATICO',
            usuarioOrigen: 'Cron Hostinger 15m',
            exitoso: true,
          });

          result.atendidasAutomaticamente++;
          result.detalles.push({
            placa: plate,
            viaje: tripNum,
            evento: c.alarm_name || c.eventName,
          });
        } catch (e: any) {
          console.error(`Error en atención automática de alarma:`, e.message);
        }
      }
    } else {
      // Fallback con el almacén local si aún no se configuran las credenciales
      const batchRes = dataStore.atenderLoteATiempo('Cron Local Simulador');
      result.atendidasAutomaticamente = batchRes.total;
      result.detalles = batchRes.atendidas.map(a => ({ placa: a.placa, viaje: a.nroViaje }));
    }

    return NextResponse.json({
      success: true,
      message: 'Ciclo de sincronización y atención autónoma completado.',
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
