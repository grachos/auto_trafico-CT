import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const semaforo = searchParams.get('semaforo') || 'TODOS';

  // 1. Si las credenciales reales de ControlT están presentes, consultar en VIVO
  if (controltClient.isConfigured()) {
    try {
      const liveData = await controltClient.getSummaryTrips();
      if (liveData && liveData.data) {
        // Mapear los registros en vivo devueltos por tower-api.controlt.com.co
        const rawTrips = liveData.data.records || liveData.data || [];
        
        let aTiempo = 0;
        let tarde = 0;
        let tolerancia = 0;
        let sinCalculo = 0;

        const viajesMapeados = rawTrips.map((r: any) => {
          let semaforoEstado: any = 'SIN_CALCULO';
          if (r.stateNextPoint === 1 || r.stateNextPointClass === 'stateNextPoint1') {
            semaforoEstado = 'A_TIEMPO';
            aTiempo++;
          } else if (r.stateNextPoint === 3 || r.stateNextPointClass === 'stateNextPoint3') {
            semaforoEstado = 'TARDE';
            tarde++;
          } else if (r.stateNextPoint === 2 || r.stateNextPointClass === 'stateNextPoint2') {
            semaforoEstado = 'TOLERANCIA';
            tolerancia++;
          } else {
            sinCalculo++;
          }

          return {
            id: String(r.idTrip || r.id || Math.random()),
            nroViaje: r.tripNumber || r.idTrip || 'N/A',
            placa: r.vehiclePlate || r.plate || 'N/A',
            conductor: r.driverName || 'Sin conductor',
            telefono: r.driverPhone || '',
            cliente: r.customerName || r.client || 'General',
            origen: r.origin || 'Origen',
            destino: r.destination || 'Destino',
            citaProgramada: r.appointmentDate || 'N/A',
            etaEstimada: r.etaDate || 'N/A',
            semaforoETA: semaforoEstado,
            porcentajeRuta: Number(r.routePercentage || 0),
            velocidadKmh: Number(r.speed || 0),
            ubicacion: r.currentLocation || r.address || 'En ruta',
            ultimoEvento: r.lastEvent || 'Tránsito normal',
            novedadResumen: r.novelty || 'Sin novedad',
            estadoViaje: r.tripState || 'En Transíto',
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
      console.warn('Error llamando API en vivo ControlT, usando fallback:', err.message);
    }
  }

  // 2. Fallback con los datos iniciales si no hay token o la API no responde
  const metricas = dataStore.getMetricas();
  const viajes = dataStore.getViajes(semaforo);

  return NextResponse.json({
    success: true,
    live: false,
    metricas,
    viajes,
  });
}
