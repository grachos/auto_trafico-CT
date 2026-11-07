import { controltClient } from '@/lib/controlt-service';
import { dataStore } from '@/lib/data-store';
import { telegramService } from '@/lib/telegram-service';
import {
  getMySqlPool,
  getAllConfiguracion,
  fueAlertaNotificadaRecientemente,
  registrarAlertaNotificada,
  registrarAuditoriaDB,
} from '@/lib/db';

export interface AnomaliaCritica {
  tipo: 'FUERA_DE_RUTA' | 'ZONA_PROHIBIDA' | 'EXCESO_VELOCIDAD' | 'RETRASO_CRITICO';
  placa: string;
  nroViaje: string;
  conductor: string;
  telefono: string;
  cliente: string;
  velocidadKmh: number;
  ubicacion: string;
  descripcion: string;
  fechaHora: string;
}

export interface CicloMonitoreoResult {
  timestamp: string;
  pilotoSeguimientoActivo: boolean;
  alertasSeguridadActivas: boolean;
  pilotoAutomaticoActivo?: boolean; // Compatibilidad retroactiva
  totalViajesSincronizados: number;
  totalAlarmasSincronizadas: number;
  alarmasAtendidasAutomaticamente: number;
  anomaliasCriticasDetectadas: number;
  alertasNotificadasTelegram: number;
  detallesAtenciones: Array<{ placa: string; viaje: string; evento: string }>;
  detallesAnomalias: AnomaliaCritica[];
}

/**
 * Ejecuta el ciclo integral de monitoreo inteligente y piloto automático de ToCIE
 */
export async function ejecutarCicloMonitoreoInteligente(): Promise<CicloMonitoreoResult> {
  const timestamp = new Date().toISOString();
  const config = await getAllConfiguracion();
  const pilotoSeguimientoActivo = (config.piloto_seguimiento || config.piloto_automatico) === 'ACTIVO';
  const alertasSeguridadActivas = config.alertas_seguridad === 'ACTIVO' || config.alertas_telegram === '1';
  const umbralVelocidad = Number(config.umbral_velocidad_kmh) || 80;

  const resultado: CicloMonitoreoResult = {
    timestamp,
    pilotoSeguimientoActivo,
    alertasSeguridadActivas,
    pilotoAutomaticoActivo: pilotoSeguimientoActivo,
    totalViajesSincronizados: 0,
    totalAlarmasSincronizadas: 0,
    alarmasAtendidasAutomaticamente: 0,
    anomaliasCriticasDetectadas: 0,
    alertasNotificadasTelegram: 0,
    detallesAtenciones: [],
    detallesAnomalias: [],
  };

  const pool = getMySqlPool();

  // 1. Obtener viajes y alarmas (en vivo de ControlT o fallback de dataStore)
  let rawTrips: any[] = [];
  let rawAlarms: any[] = [];

  if (controltClient.isConfigured()) {
    try {
      const tripsData = await controltClient.getSummaryTrips(200, 1);
      rawTrips = tripsData?.result || tripsData?.data?.records || [];
    } catch (e: any) {
      console.warn('Error descargando viajes de ControlT para monitoreo:', e.message);
    }

    try {
      const alarmsData = await controltClient.getAlarmsToAttend(100, 1);
      rawAlarms = alarmsData?.result || alarmsData?.data?.records || (Array.isArray(alarmsData) ? alarmsData : []);
    } catch (e: any) {
      console.warn('Error descargando alarmas de ControlT para monitoreo:', e.message);
    }
  }

  // Fallback a almacén local si ControlT no responde o no está configurado
  if (rawTrips.length === 0) {
    rawTrips = dataStore.getViajes('TODOS').map(v => ({
      id_monitoring_order: v.id,
      trip_number: v.nroViaje,
      license_plate: v.placa,
      driver_name: v.conductor,
      driver_phone: v.telefono,
      company_customer_name: v.cliente,
      origin_city_name: v.origen,
      destiny_city_name: v.destino,
      state_next_point: v.semaforoETA === 'A_TIEMPO' ? '1' : v.semaforoETA === 'TARDE' ? '3' : '2',
      description_state_next_point: v.semaforoETA,
      percentage_travel: v.porcentajeRuta,
      speed: v.velocidadKmh,
      current_address_location: v.ubicacion,
      last_event: v.ultimoEvento,
    }));
  }

  if (rawAlarms.length === 0) {
    rawAlarms = dataStore.getAlarmas('TODAS', true).map(a => ({
      id_monitoring_orders_alarm: a.id,
      trip_number: a.nroViaje,
      license_plate: a.placa,
      driver_name: a.conductor,
      driver_phone: a.telefono,
      company_customer_name: a.cliente,
      priority: a.prioridad,
      alarm_name: a.evento,
      speed: a.velocidadKmh,
      address: a.ubicacion,
      state_next_point: a.semaforoETA === 'A_TIEMPO' ? '1' : a.semaforoETA === 'TARDE' ? '3' : '2',
      description_state_next_point: a.semaforoETA,
    }));
  }

  resultado.totalViajesSincronizados = rawTrips.length;
  resultado.totalAlarmasSincronizadas = rawAlarms.length;

  // 2. Sincronización en MySQL de los viajes para mantener el estado fresco
  if (pool && rawTrips.length > 0) {
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
        // Ignorar duplicados o errores menores en viajes individuales
      }
    }
  }

  // =========================================================================
  // RUTINA A: PILOTO DE SEGUIMIENTO (Solo si el Administrador lo activó)
  // =========================================================================
  if (pilotoSeguimientoActivo) {
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

        if (controltClient.isConfigured()) {
          await controltClient.attendAlarm({
            idMonitoringOrdersAlarm: alarmId,
            numberTrip: tripNum,
            licensePlate: plate,
            noveltySelected: 1, // "En ruta sin novedad alguna"
            codeNoveltySelected: 'EN_RUTA',
            comment,
            address,
          });
        } else {
          dataStore.atenderAlarma(alarmId, 'En ruta sin novedad alguna', comment, 'Piloto Automático Local');
        }

        await registrarAuditoriaDB({
          alarmaId: String(alarmId),
          nroViaje: tripNum,
          placa: plate,
          novedad: 'En ruta sin novedad alguna',
          comentario: comment,
          canalOrigen: 'PILOTO_AUTOMATICO',
          usuarioOrigen: 'Piloto Automático ToCIE',
          exitoso: true,
        });

        resultado.alarmasAtendidasAutomaticamente++;
        resultado.detallesAtenciones.push({
          placa: plate,
          viaje: tripNum,
          evento: c.alarm_name || c.eventName || 'LLAMADA DE SEGUIMIENTO',
        });
      } catch (err: any) {
        console.error('Error atendiendo alarma en piloto automático:', err.message);
      }
    }
  }

  // =========================================================================
  // RUTINA B: MOTOR DE SEGURIDAD Y ANOMALÍAS CRÍTICAS (Siempre activo)
  // =========================================================================
  const anomaliasEncontradas: AnomaliaCritica[] = [];

  // B.1. Escaneo en Cola de Alarmas
  for (const a of rawAlarms) {
    const prioridad = String(a.priority || a.priorityName || '').toUpperCase();
    const evento = String(a.alarm_name || a.eventName || a.event || '').toUpperCase();
    const placa = String(a.license_plate || a.vehiclePlate || '').toUpperCase().trim();
    const nroViaje = String(a.trip_number || a.tripNumber || 'N/A');
    const conductor = String(a.driver_name || a.driverName || 'Sin conductor');
    const telefono = String(a.driver_phone || a.driverPhone || a.telephone || '3000000000');
    const cliente = String(a.company_customer_name || a.customerName || 'General');
    const velocidad = Number(a.speed || 0);
    const ubicacion = String(a.address || a.current_address_location || 'En ruta');

    if (!placa || placa === 'N/A') continue;

    // Caso: Fuera de Ruta o Crítica
    if (evento.includes('FUERA DE RUTA') || prioridad.includes('CRITIC') || evento.includes('PANICO') || evento.includes('PÁNICO')) {
      anomaliasEncontradas.push({
        tipo: 'FUERA_DE_RUTA',
        placa,
        nroViaje,
        conductor,
        telefono,
        cliente,
        velocidadKmh: velocidad,
        ubicacion,
        descripcion: `Alarma ${prioridad}: ${evento}. Vehículo fuera del corredor autorizado.`,
        fechaHora: new Date().toLocaleTimeString(),
      });
    }

    // Caso: Zona Prohibida
    if (evento.includes('ZONA PROHIBIDA') || evento.includes('PUNTO ROJO') || evento.includes('NO AUTORIZADA')) {
      anomaliasEncontradas.push({
        tipo: 'ZONA_PROHIBIDA',
        placa,
        nroViaje,
        conductor,
        telefono,
        cliente,
        velocidadKmh: velocidad,
        ubicacion,
        descripcion: `Ingreso o permanencia en zona de alto riesgo: ${evento}.`,
        fechaHora: new Date().toLocaleTimeString(),
      });
    }
  }

  // B.2. Escaneo en Telemetría de Viajes (Excesos de velocidad y eventos en tránsito)
  for (const v of rawTrips) {
    const placa = String(v.license_plate || v.vehiclePlate || '').toUpperCase().trim();
    const nroViaje = String(v.trip_number || v.tripNumber || 'N/A');
    const conductor = String(v.driver_name || v.driverName || 'Sin conductor');
    const telefono = String(v.driver_phone || v.driverPhone || v.telephone || '3000000000');
    const cliente = String(v.company_customer_name || v.customerName || 'General');
    const velocidad = Number(v.speed || 0);
    const ubicacion = String(v.current_address_location || v.currentLocation || 'En ruta');
    const ultimoEvento = String(v.last_event || v.lastEvent || '').toUpperCase();

    if (!placa || placa === 'N/A') continue;

    // Caso: Exceso de velocidad
    if (velocidad > umbralVelocidad) {
      anomaliasEncontradas.push({
        tipo: 'EXCESO_VELOCIDAD',
        placa,
        nroViaje,
        conductor,
        telefono,
        cliente,
        velocidadKmh: velocidad,
        ubicacion,
        descripcion: `Exceso de velocidad registrado: ${velocidad} km/h (Límite configurado: ${umbralVelocidad} km/h).`,
        fechaHora: new Date().toLocaleTimeString(),
      });
    }

    // Caso: Zona Prohibida detectada en el último reporte de viaje
    if (ultimoEvento.includes('ZONA PROHIBIDA') || ultimoEvento.includes('PUNTO ROJO')) {
      anomaliasEncontradas.push({
        tipo: 'ZONA_PROHIBIDA',
        placa,
        nroViaje,
        conductor,
        telefono,
        cliente,
        velocidadKmh: velocidad,
        ubicacion,
        descripcion: `Reporte en telemetría de viaje: ${ultimoEvento}.`,
        fechaHora: new Date().toLocaleTimeString(),
      });
    }
  }

  // B.3. Deduplicación Anti-Spam y Despacho a Telegram
  resultado.anomaliasCriticasDetectadas = anomaliasEncontradas.length;

  for (const anomalia of anomaliasEncontradas) {
    // Si las alertas están en pausa, no se despachan ni se marcan como notificadas
    if (!alertasSeguridadActivas) {
      resultado.detallesAnomalias.push(anomalia);
      continue;
    }

    // Verificar si ya fue notificada en los últimos 60 minutos
    const yaNotificada = await fueAlertaNotificadaRecientemente(anomalia.placa, anomalia.tipo, 60);
    if (yaNotificada) {
      continue; // Evitar saturación si ya se le avisó al operador hace poco
    }

    resultado.detallesAnomalias.push(anomalia);

    const emojiTipo = 
      anomalia.tipo === 'FUERA_DE_RUTA' ? '🚨 FUERA DE RUTA / DESVÍO' :
      anomalia.tipo === 'ZONA_PROHIBIDA' ? '⛔ ZONA PROHIBIDA DETECTADA' :
      anomalia.tipo === 'EXCESO_VELOCIDAD' ? '⚡ EXCESO DE VELOCIDAD CRÍTICO' : '⚠️ ALERTA OPERATIVA';

    const mensajeTelegram = 
      `🚨 *ALERTA CRÍTICA DE TRÁFICO — ToCIE* 🚛\n\n` +
      `• *Severidad:* ${emojiTipo}\n` +
      `• *Vehículo:* \`${anomalia.placa}\` (Viaje \`${anomalia.nroViaje}\`)\n` +
      `• *Cliente:* ${anomalia.cliente}\n` +
      `• *Conductor:* ${anomalia.conductor}\n` +
      `• *Teléfono:* \`${anomalia.telefono}\`\n` +
      `• *Velocidad:* *${anomalia.velocidadKmh} km/h*\n` +
      `• *Ubicación:* ${anomalia.ubicacion}\n` +
      `• *Detalle:* _${anomalia.descripcion}_\n\n` +
      `⚠️ *Acción Requerida:* Llamar inmediatamente al conductor para verificar novedad.`;

    const mapsQuery = encodeURIComponent(`${anomalia.ubicacion}, Colombia`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    const keyboard: any[] = [
      [
        { text: `📞 Llamar: ${anomalia.telefono}`, url: `tel:${anomalia.telefono.replace(/\s+/g, '')}` },
        { text: '🗺️ Ver en Google Maps', url: mapsUrl },
      ],
      [
        { text: '🌐 Abrir Tablero ToCIE', url: 'https://auto-trafico-ct.vercel.app' },
      ],
    ];

    const resTelegram = await telegramService.broadcastAlert(mensajeTelegram, keyboard);
    if (resTelegram.sent > 0) {
      resultado.alertasNotificadasTelegram++;

      // Guardar en la base de datos de alertas notificadas SOLO cuando se despachó con éxito
      await registrarAlertaNotificada({
        tipoEvento: anomalia.tipo,
        nroViaje: anomalia.nroViaje,
        placa: anomalia.placa,
        conductor: anomalia.conductor,
        telefono: anomalia.telefono,
        cliente: anomalia.cliente,
        velocidadKmh: anomalia.velocidadKmh,
        ubicacion: anomalia.ubicacion,
        descripcion: anomalia.descripcion,
        canalNotificado: 'TELEGRAM',
      });
    }
  }

  return resultado;
}

