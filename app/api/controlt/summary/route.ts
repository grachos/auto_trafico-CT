import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const semaforo = searchParams.get('semaforo') || 'TODOS';

  if (controltClient.isConfigured()) {
    try {
      const liveData = await controltClient.getSummaryTrips(200, 1);
      
      // ControlT devuelve: { info: { count: 175, ... }, result: [ { trip_number, license_plate, ... } ] }
      const rawTrips = liveData?.result || liveData?.data?.records || [];

      if (Array.isArray(rawTrips) && rawTrips.length > 0) {
        let aTiempo = 0;
        let tarde = 0;
        let tolerancia = 0;
        let sinCalculo = 0;

        const viajesMapeados = rawTrips.map((r: any) => {
          let semaforoEstado: any = 'SIN_CALCULO';
          const snp = String(r.state_next_point || r.stateNextPoint || '');
          const desc = String(r.description_state_next_point || '').toUpperCase();

          if (snp === '1' || desc.includes('A TIEMPO')) {
            semaforoEstado = 'A_TIEMPO';
            aTiempo++;
          } else if (snp === '3' || desc.includes('TARDE') || desc.includes('RETRAS')) {
            semaforoEstado = 'TARDE';
            tarde++;
          } else if (snp === '2' || desc.includes('TOLERANCIA')) {
            semaforoEstado = 'TOLERANCIA';
            tolerancia++;
          } else {
            sinCalculo++;
          }

          return {
            id: String(r.id_monitoring_order || r.idTrip || Math.random()),
            nroViaje: r.trip_number || r.tripNumber || 'N/A',
            placa: r.license_plate || r.vehiclePlate || 'N/A',
            conductor: r.driver_name || r.driverName || 'Sin conductor',
            telefono: r.driver_phone || r.driverPhone || '',
            cliente: r.company_customer_name || r.customerName || 'General',
            origen: r.origin_city_name || r.origin || 'Origen',
            destino: r.destiny_city_name || r.destination || 'Destino',
            citaProgramada: r.appointment_fulfillment || r.appointmentDate || 'N/A',
            etaEstimada: r.latest_gps_report_Controlt || r.etaDate || 'N/A',
            semaforoETA: semaforoEstado,
            porcentajeRuta: Number(r.percentage_travel || r.routePercentage || 0),
            velocidadKmh: Number(r.speed || 0),
            ubicacion: r.current_address_location || r.currentLocation || 'En ruta',
            ultimoEvento: r.last_event || r.lastEvent || 'Tránsito',
            novedadResumen: r.novelty || 'Sin novedad',
            estadoViaje: r.state_travel || 'En Transíto',
          };
        });

        const viajesFiltrados = semaforo === 'TODOS'
          ? viajesMapeados
          : viajesMapeados.filter((v: any) => v.semaforoETA === semaforo);

        return NextResponse.json({
          success: true,
          live: true,
          metricas: {
            totalViajes: viajesMapeados.length,
            aTiempo,
            tarde,
            tolerancia,
            sinCalculo,
            totalAlarmas: dataStore.getMetricas().totalAlarmas,
            alarmasCriticas: dataStore.getMetricas().alarmasCriticas,
            alarmasAltas: dataStore.getMetricas().alarmasAltas,
            alarmasBajas: dataStore.getMetricas().alarmasBajas,
            alarmasAtendidasHoy: dataStore.getMetricas().alarmasAtendidasHoy,
          },
          viajes: viajesFiltrados,
        });
      }
    } catch (err: any) {
      console.warn('[ControlT] Error obteniendo viajes en vivo:', err.message);
    }
  }

  // Fallback seguro
  return NextResponse.json({
    success: true,
    live: false,
    metricas: dataStore.getMetricas(),
    viajes: dataStore.getViajes(semaforo),
  });
}
