import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { getMySqlPool, registrarAuditoriaDB } from '@/lib/db';
import { telegramService } from '@/lib/telegram-service';
import { dataStore } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Validación de seguridad opcional de Vercel Cron
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
      const liveTripsData = await controltClient.getSummaryTrips();
      if (liveTripsData && liveTripsData.data) {
        const rawTrips = liveTripsData.data.records || liveTripsData.data || [];
        result.syncedViajes = rawTrips.length;

        if (pool && rawTrips.length > 0) {
          for (const r of rawTrips) {
            try {
              const semaforo = r.stateNextPoint === 1 ? 'A_TIEMPO' : (r.stateNextPoint === 3 ? 'TARDE' : 'TOLERANCIA');
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
                  String(r.idTrip || Math.random()),
                  String(r.tripNumber || r.idTrip || 'N/A'),
                  String(r.vehiclePlate || 'N/A'),
                  String(r.driverName || 'Sin conductor'),
                  String(r.customerName || 'General'),
                  String(r.origin || 'Origen'),
                  String(r.destination || 'Destino'),
                  semaforo,
                  Number(r.routePercentage || 0),
                  Number(r.speed || 0),
                  String(r.currentLocation || 'En ruta'),
                  String(r.lastEvent || 'Tránsito'),
                ]
              );
            } catch (e: any) {
              console.warn(`Error guardando viaje ${r.tripNumber} en MySQL:`, e.message);
            }
          }
        }
      }

      // 2. Sincronizar Alarmas en Vivo desde ControlT
      const liveAlarmsData = await controltClient.getAlarmsToAttend();
      if (liveAlarmsData && (liveAlarmsData.data || Array.isArray(liveAlarmsData))) {
        const rawAlarms = liveAlarmsData.data?.records || liveAlarmsData.data || (Array.isArray(liveAlarmsData) ? liveAlarmsData : []);
        result.syncedAlarmas = rawAlarms.length;

        // Detectar alarmas críticas para notificación
        const criticas = rawAlarms.filter((a: any) => 
          String(a.priorityName || a.priority || '').toUpperCase().includes('CRITIC') ||
          String(a.eventName || '').toUpperCase().includes('FUERA DE RUTA')
        );
        result.alarmasCriticasDetectadas = criticas.length;

        // 3. Proceso Autónomo: Atender llamadas de seguimiento de viajes a tiempo
        const candidatas = rawAlarms.filter((a: any) => 
          a.stateNextPoint === 1 && 
          String(a.eventName || a.event || '').toUpperCase().includes('LLAMADA DE SEGUIMIENTO')
        );

        for (const c of candidatas) {
          try {
            const comment = `Vehículo en movimiento a ${c.speed || 50} km/h en ${c.currentLocation || 'ruta'}. Ruta sin novedad alguna.`;
            await controltClient.attendAlarm({
              idAlarm: c.idAlarm || c.id,
              idNoveltyType: 1, // "En ruta sin novedad alguna"
              description: comment,
            });

            await registrarAuditoriaDB({
              alarmaId: String(c.idAlarm || c.id),
              nroViaje: String(c.tripNumber || 'N/A'),
              placa: String(c.vehiclePlate || 'N/A'),
              novedad: 'En ruta sin novedad alguna',
              comentario: comment,
              canalOrigen: 'PILOTO_AUTOMATICO',
              usuarioOrigen: 'Vercel Cron 15m',
            });

            result.atendidasAutomaticamente++;
            result.detalles.push({
              placa: c.vehiclePlate,
              viaje: c.tripNumber,
              evento: c.eventName,
            });
          } catch (e: any) {
            console.error(`Error en atención automática de alarma ${c.idAlarm}:`, e.message);
          }
        }
      }
    } else {
      // Fallback con el almacén local si aún no se configuran las credenciales en producción
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
