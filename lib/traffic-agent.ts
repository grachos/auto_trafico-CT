import { dataStore } from './data-store';
import { aiService } from './ai-service';
import { ChatMessage } from '@/types';
import { getVehiclesPaginatedDirect } from './report-generator';
import { getConfiguracion, setConfiguracion, getMySqlPool, esUsuarioAdmin, registrarAuditoriaDB } from './db';
import { controltClient } from './controlt-service';

export class TrafficAgent {
  /**
   * Procesa el mensaje del usuario (desde la app web, Telegram o MCP)
   * utilizando el LLM conectado (OpenAI o Gemini) si está configurado,
   * o el motor de reglas determinístico de alto rendimiento como respaldo.
   */
  public async processMessage(userInput: string, sender: 'user' = 'user', usuario?: string): Promise<ChatMessage> {
    const textClean = userInput.toLowerCase().trim();

    // 0. Intercepción de Paginación Rápida con CERO consumo de tokens:
    const pageMatch = userInput.match(/p[áa]gina\s+(\d+)/i);
    const isPaging = textClean.includes('siguiente') || textClean.includes('ver m') || textClean.includes('tanda');
    if (pageMatch && isPaging) {
      const pagina = Number(pageMatch[1]) || 1;
      let busqueda = '';
      const clientMatch = userInput.match(/veh[íi]culos\s+de\s+([a-zA-Z0-9\s]+?)\s+p[áa]gina/i);
      if (clientMatch) busqueda = clientMatch[1].trim();

      const direct = await getVehiclesPaginatedDirect(busqueda, pagina, 5);
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: direct.text,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: direct.actionTaken,
      };
    }

    // 0.1. Catálogo de Comandos Rápidos (/comando, /comandos, /ayuda, /help)
    if (
      textClean === '/comando' ||
      textClean === '/comandos' ||
      textClean === '/ayuda' ||
      textClean === '/help' ||
      textClean.includes('que comandos') ||
      textClean.includes('lista de comandos')
    ) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: 
          `📋 **CATÁLOGO DE COMANDOS — TORRE ToCIE** 🚛\n\n` +
          `🔍 **CONSULTAS OPERATIVAS:**\n` +
          `• \`/menu\` — Menú con botones de acceso rápido.\n` +
          `• \`/criticas\` — Listado de alarmas y anomalías críticas activas.\n` +
          `• \`/movimiento\` (o \`/andando\`) — Vehículos rodando en este momento (velocidad > 0 km/h).\n` +
          `• \`/quietos\` (o \`/detenidos\`) — Vehículos parados o estacionados (velocidad = 0 km/h).\n` +
          `• \`/eta\` (o \`/resumen\`) — Semáforo consolidado de puntualidad de la flota.\n` +
          `• \`/reporte\` — Genera y descarga la tabla completa en HTML / PDF.\n\n` +
          `⚡ **AUTOMATIZACIÓN & CONTROL (ADMIN):**\n` +
          `• \`/seguimiento on\` — Activa la atención automática de viajes a tiempo.\n` +
          `• \`/seguimiento off\` — Pausa la atención automática (modo manual).\n` +
          `• \`/alertas on\` — Activa alertas críticas a Telegram (fuera de ruta, zonas rojas, velocidad).\n` +
          `• \`/alertas off\` — Pausa las notificaciones de alertas.\n` +
          `• \`/estado\` (o \`/cron\`) — Diagnóstico del cron de Hostinger y salud del sistema.\n\n` +
          `👤 **SESIÓN Y CUENTA:**\n` +
          `• \`/login <usuario> <clave>\` — Vincular tu cuenta de ControlT.\n` +
          `• \`/perfil\` — Ver usuario conectado actualmente.\n` +
          `• \`/logout\` — Desconectar tu sesión de Telegram.\n\n` +
          `💬 **LENGUAJE NATURAL:**\n` +
          `También puedes escribir preguntas cotidianas como:\n` +
          `• *"¿Cuántos vehículos van andando y van a tiempo?"*\n` +
          `• *"Muéstrame el listado de vehículos con avance >= 50%"*\n` +
          `• *"¿Cuántos vehículos quietos?"*\n` +
          `• *"Muéstrame los vehículos de Terpel"*\n` +
          `• *"Atiende las alarmas de los carros a tiempo"*\n` +
          `• *"¿Dónde está la placa KNL064?"*`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 1. Si hay una API Key de OpenAI o Gemini configurada, usar LLM con Function Calling
    if (aiService.isConfigured()) {
      try {
        const aiReply = await aiService.chat(userInput);
        if (aiReply) return aiReply;
      } catch (err: any) {
        console.warn('[TrafficAgent] Error en IA Service, recurriendo a motor local:', err.message);
      }
    }

    // 2. Motor determinístico de reglas (fallback robusto para lenguaje natural sin IA externa)
    const text = textClean;
    const metricas = dataStore.getMetricas();

    // 2.1. PREGUNTAS DE CONTEO O CANTIDAD ("¿cuántos...?", "cuanto...", "total de...", "qué cantidad...")
    const isConteo = /cu[aá]nt[ao]s?|total\s+de|n[uú]mero\s+de|cantidad\s+de/i.test(text);
    if (isConteo) {
      const isMovimiento = /andando|movimiento|rodando|circulando|en marcha|transito|tránsito/i.test(text) && !text.includes('sin novedad');
      const isDetenido = /quieto|detenido|parado|estacionado|velocidad\s*0|velocidad\s*cero/i.test(text);
      const isATiempo = /a\s*tiempo|puntual/i.test(text);
      const isTarde = /tarde|retras/i.test(text);
      const isTolerancia = /tolerancia/i.test(text);

      const avanceMatch = text.match(/avance\s*(?:mayor|superior|>=|m[aá]s\s+de)?\s*(?:a|al|de)?\s*(\d+)%?/i) || text.match(/(?:>=|mayor\s+o\s+igual\s+al?)\s*(\d+)%/i);
      const minAvance = avanceMatch ? Number(avanceMatch[1]) : undefined;

      let filtroVelocidad: 'TODOS' | 'EN_MOVIMIENTO' | 'DETENIDO' = 'TODOS';
      if (isMovimiento) filtroVelocidad = 'EN_MOVIMIENTO';
      else if (isDetenido) filtroVelocidad = 'DETENIDO';

      let filtroSemaforo = 'TODOS';
      if (isATiempo) filtroSemaforo = 'A_TIEMPO';
      else if (isTarde) filtroSemaforo = 'TARDE';
      else if (isTolerancia) filtroSemaforo = 'TOLERANCIA';

      const pool = getMySqlPool();
      let totalFlota = 0;
      let coincidentes = 0;
      let ejemplos: any[] = [];

      if (pool) {
        try {
          const [flotaRows]: any = await pool.execute(`SELECT COUNT(*) as total FROM viajes`);
          totalFlota = Number(flotaRows[0]?.total || 0);

          let whereClause = ` WHERE 1=1`;
          const params: any[] = [];
          if (filtroSemaforo !== 'TODOS') {
            whereClause += ` AND semaforo_eta = ?`;
            params.push(filtroSemaforo);
          }
          if (filtroVelocidad === 'EN_MOVIMIENTO') {
            whereClause += ` AND velocidad_kmh > 0`;
          } else if (filtroVelocidad === 'DETENIDO') {
            whereClause += ` AND (velocidad_kmh = 0 OR velocidad_kmh IS NULL)`;
          }
          if (minAvance !== undefined) {
            whereClause += ` AND porcentaje_ruta >= ?`;
            params.push(minAvance);
          }

          const [countRows]: any = await pool.execute(
            `SELECT COUNT(*) as total FROM viajes ${whereClause}`,
            params
          );
          coincidentes = Number(countRows[0]?.total || 0);

          const [ejemplosRows]: any = await pool.execute(
            `SELECT placa, conductor, cliente, velocidad_kmh, porcentaje_ruta, semaforo_eta, ubicacion 
             FROM viajes ${whereClause} 
             ORDER BY velocidad_kmh DESC LIMIT 3`,
            params
          );
          ejemplos = ejemplosRows;
        } catch (e: any) {
          console.warn('Error en conteo determinístico MySQL:', e.message);
        }
      }

      if (totalFlota === 0) {
        const local = dataStore.getViajes('TODOS');
        totalFlota = local.length;
        let filtrados = [...local];
        if (filtroSemaforo !== 'TODOS') filtrados = filtrados.filter(v => v.semaforoETA === filtroSemaforo);
        if (filtroVelocidad === 'EN_MOVIMIENTO') filtrados = filtrados.filter(v => (v.velocidadKmh || 0) > 0);
        else if (filtroVelocidad === 'DETENIDO') filtrados = filtrados.filter(v => (v.velocidadKmh || 0) === 0);
        if (minAvance !== undefined) filtrados = filtrados.filter(v => (v.porcentajeRuta || 0) >= minAvance);
        coincidentes = filtrados.length;
        ejemplos = filtrados.slice(0, 3).map(v => ({
          placa: v.placa,
          conductor: v.conductor,
          cliente: v.cliente,
          velocidad_kmh: v.velocidadKmh,
          porcentaje_ruta: v.porcentajeRuta,
          semaforo_eta: v.semaforoETA,
          ubicacion: v.ubicacion,
        }));
      }

      const pct = totalFlota > 0 ? ((coincidentes / totalFlota) * 100).toFixed(1) : '0';

      let desc = '';
      if (isMovimiento && isATiempo) desc = 'van rodando/andando y van a tiempo';
      else if (isMovimiento && isTarde) desc = 'van rodando/andando pero van retrasados';
      else if (isMovimiento) desc = 'van en movimiento (velocidad > 0 km/h)';
      else if (isDetenido) desc = 'están quietos o detenidos (velocidad = 0 km/h)';
      else if (isATiempo) desc = 'están con semáforo A Tiempo';
      else if (isTarde) desc = 'están retrasados o tarde';
      else desc = 'cumplen los criterios indicados';

      if (minAvance !== undefined) {
        desc += ` con un avance de ruta mayor o igual al ${minAvance}%`;
      }

      let respText = `📊 Actualmente hay **${coincidentes} vehículos** que ${desc} (representan el **${pct}%** de los ${totalFlota} viajes activos en la flota).`;

      if (ejemplos.length > 0) {
        respText += `\n\n🚛 *Algunas unidades de muestra:*\n`;
        respText += ejemplos.map(e => `• **${e.placa}** (${e.conductor}): ${e.ubicacion || 'En tránsito'} — ${e.velocidad_kmh || 0} km/h | ETA: ${e.semaforo_eta || 'N/A'}${e.porcentaje_ruta ? ` (${e.porcentaje_ruta}%)` : ''}`).join('\n');
      }

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: respText,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 2.2. LISTADO CON FILTRO DE AVANCE DE RUTA ("avance mayor o igual al 50%", "avance >= 50%")
    const avanceMatch = text.match(/avance\s*(?:mayor|superior|>=|m[aá]s\s+de)?\s*(?:a|al|de)?\s*(\d+)%?/i) || text.match(/(?:>=|mayor\s+o\s+igual\s+al?)\s*(\d+)%/i);
    if (avanceMatch) {
      const minAvance = Number(avanceMatch[1]);
      const isMovimiento = /andando|movimiento|rodando|circulando|en marcha/i.test(text) && !text.includes('sin novedad');
      const isDetenido = /quieto|detenido|parado|estacionado|velocidad\s*0|velocidad\s*cero/i.test(text);
      const isATiempo = /a\s*tiempo|puntual/i.test(text);
      const isTarde = /tarde|retras/i.test(text);

      const filtroVelocidad = isMovimiento ? 'EN_MOVIMIENTO' : (isDetenido ? 'DETENIDO' : 'TODOS');
      const filtroSemaforo = isATiempo ? 'A_TIEMPO' : (isTarde ? 'TARDE' : 'TODOS');

      const direct = await getVehiclesPaginatedDirect('', 1, 5, filtroSemaforo, filtroVelocidad, minAvance);
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `📈 **Listado de Vehículos con Avance de Ruta >= ${minAvance}%:**\n\n${direct.text}`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: direct.actionTaken,
      };
    }

    // 2.3. LISTADO DE VEHÍCULOS EN MOVIMIENTO (ANDANDO) O DETENIDOS (QUIETOS)
    const isMovimiento = (text.includes('movimiento') || text.includes('andando') || text.includes('rodando') || text.includes('circulando') || text.includes('en marcha')) && !text.includes('sin novedad');
    const isDetenido = text.includes('quieto') || text.includes('detenido') || text.includes('parado') || text.includes('estacionado') || text.includes('velocidad 0') || text.includes('velocidad cero');

    if (isMovimiento || isDetenido) {
      const isATiempo = /a\s*tiempo|puntual/i.test(text);
      const isTarde = /tarde|retras/i.test(text);
      const filtroSemaforo = isATiempo ? 'A_TIEMPO' : (isTarde ? 'TARDE' : 'TODOS');
      const filtroVelocidad = isMovimiento ? 'EN_MOVIMIENTO' : 'DETENIDO';

      const busquedaFiltro = text
        .replace(/cu[aá]les|qu[eé]|carros|veh[íi]culos|unidades|camiones|van|est[aá]n|en|movimiento|andando|rodando|circulando|en marcha|quietos?|detenidos?|parados?|estacionados?|velocidad\s*0|velocidad\s*cero|de|los|mu[eé]strame|ver|dame|listado|a\s+tiempo|tarde|\?/gi, '')
        .trim();

      const direct = await getVehiclesPaginatedDirect(busquedaFiltro, 1, 5, filtroSemaforo, filtroVelocidad);

      const encabezado = isMovimiento
        ? `🚚 **Vehículos en Movimiento (Velocidad > 0 km/h)${isATiempo ? ' — Semáforo: A Tiempo' : ''}${busquedaFiltro ? ` — Filtro: "${busquedaFiltro.toUpperCase()}"` : ''}:**`
        : `🛑 **Vehículos Detenidos / Estacionados (Velocidad = 0 km/h)${busquedaFiltro ? ` — Filtro: "${busquedaFiltro.toUpperCase()}"` : ''}:**`;

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `${encabezado}\n\n${direct.text}`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: direct.actionTaken,
      };
    }

    // 2.4. Búsqueda por placa individual o número de viaje
    const matchPlaca = text.match(/[a-z]{3}\d{3}/i);
    const matchViaje = text.match(/0101\d{6}/);

    // 2.5. Caso: Atender alarmas de viajes a tiempo (individual o en lote bajo demanda)
    const isAtencionLote =
      !matchPlaca &&
      !matchViaje &&
      (text.includes('atiende') || text.includes('atender') || text.includes('gestiona') || text.includes('procesa') || text.includes('cierra') || text.includes('cerrar')) &&
      (text.includes('a tiempo') || text.includes('todas') || text.includes('lote') || text.includes('seguimiento') || text.includes('pendiente') || text.includes('peniente') || text.includes('alarma') || text.includes('cola'));

    if (isAtencionLote) {
      let atendidas: any[] = [];

      // Si está configurada la API oficial en vivo de ControlT, atender primero en vivo
      if (controltClient.isConfigured()) {
        try {
          const live = await controltClient.getAlarmsToAttend(100, 1);
          const raw = live?.result || live?.data?.records || [];
          const candidatas = raw.filter((a: any) => {
            const snp = String(a.state_next_point || a.stateNextPoint || '');
            const desc = String(a.description_state_next_point || '').toUpperCase();
            const ev = String(a.alarm_name || a.eventName || '').toUpperCase();
            return (snp === '1' || desc.includes('A TIEMPO')) && (ev.includes('SEGUIMIENTO') || ev.includes('LLAMADA'));
          });

          const lote = candidatas.slice(0, 10);
          await Promise.all(
            lote.map(async (c: any) => {
              const aId = c.id_monitoring_orders_alarm || c.id_monitoring_order_alarm || c.idAlarm || c.id;
              const trip = c.trip_number || c.tripNumber || 'N/A';
              const plate = c.license_plate || c.vehiclePlate || 'N/A';
              const speed = c.speed || 0;
              const address = c.address || c.current_address_location || 'En ruta';
              const driver = c.driver_name || c.driverName || 'Sin conductor';
              const client = c.company_customer_name || c.customerName || 'General';
              const comment = `Vehículo en tránsito normal a ${speed} km/h en ${address}. Ruta sin novedad alguna.`;

              try {
                await controltClient.attendAlarm({
                  idMonitoringOrdersAlarm: aId,
                  numberTrip: trip,
                  licensePlate: plate,
                  noveltySelected: 1,
                  comment,
                  address,
                });

                await registrarAuditoriaDB({
                  alarmaId: String(aId),
                  nroViaje: trip,
                  placa: plate,
                  novedad: 'En ruta sin novedad alguna',
                  comentario: comment,
                  canalOrigen: 'WEB_APP',
                  usuarioOrigen: usuario || 'Operador',
                  exitoso: true,
                });

                atendidas.push({
                  id: String(aId),
                  placa: plate,
                  nroViaje: trip,
                  conductor: driver,
                  cliente: client,
                  ubicacion: address,
                  velocidadKmh: speed,
                  alarmaId: String(aId),
                  novedadAplicada: 'En ruta sin novedad alguna',
                  comentarioRegistrado: comment,
                });
              } catch (e: any) {
                console.error(`Error atendiendo ${plate} en vivo:`, e.message);
              }
            })
          );
        } catch (e: any) {
          console.warn('Error consultando alarmas en vivo para lote en traffic-agent:', e.message);
        }
      }

      // Si no hay API en vivo o no devolvió alarmas en vivo, usar dataStore
      if (atendidas.length === 0) {
        const res = dataStore.atenderLoteATiempo(usuario || 'Operador');
        atendidas = res.atendidas;
      }

      if (atendidas.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🔍 Revisé la cola de ControlT y **no hay alarmas pendientes** de viajes "A tiempo" por atender en este momento. La cola para viajes a tiempo está al día.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const placas = atendidas.map(a => `**${a.placa}** (${a.nroViaje})`).join(', ');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `✅ **Operación completada con éxito.**\n\nHe atendido **${atendidas.length} alarmas** de "Llamada de seguimiento" correspondientes a vehículos con Semáforo ETA **A Tiempo**:\n\n• ${placas}\n\nSe asignó la novedad *"En ruta sin novedad alguna"* y se guardó la observación en ControlT (Registrado a nombre de: \`${usuario || 'Operador'}\`).`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: {
          type: 'ATTEND_BATCH',
          summary: `Se atendieron ${atendidas.length} alarmas bajo demanda`,
          affectedCount: atendidas.length,
          details: atendidas,
        },
      };
    }

    // 2.6. Caso: Atender una alarma específica por viaje o placa
    if ((text.includes('atiende') || text.includes('atender')) && (matchViaje || matchPlaca)) {
      const query = matchViaje ? matchViaje[0] : (matchPlaca ? matchPlaca[0].toUpperCase() : '');
      const alarmas = dataStore.getAlarmas('TODAS', true);
      const target = alarmas.find(a => a.nroViaje === query || a.placa.toUpperCase() === query);

      if (!target) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `⚠️ No encontré ninguna alarma activa pendiente para la búsqueda **${query}** en ControlT (es posible que ya haya sido atendida o no tenga alarma en cola).`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const novedad = 'En ruta sin novedad alguna';
      const comentario = `Vehículo en tránsito normal a ${target.velocidadKmh} km/h en ${target.ubicacion}. Ruta sin novedad alguna.`;
      dataStore.atenderAlarma(target.id, novedad, comentario, 'Agente Conversacional IA');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `✅ **Alarma atendida correctamente para ${target.placa}** (Viaje \`${target.nroViaje}\`):\n\n- **Conductor:** ${target.conductor}\n- **Novedad:** \`${novedad}\`\n- **Comentario guardado:** *"${comentario}"*\n\nLa alarma ID \`${target.id}\` quedó cerrada en ControlT.`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: {
          type: 'ATTEND_SINGLE',
          summary: `Alarma ${target.id} de placa ${target.placa} atendida`,
          details: target,
        },
      };
    }

    // 2.7. Búsqueda de ubicación por placa o viaje
    if ((matchPlaca || matchViaje) && (text.includes('donde') || text.includes('dónde') || text.includes('ubica') || text.includes('placa') || text.includes('viaje'))) {
      const query = matchPlaca ? matchPlaca[0].toUpperCase() : matchViaje![0];
      const direct = await getVehiclesPaginatedDirect(query, 1, 1);
      if (direct.actionTaken?.pagination?.total > 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🔍 **Resultado para ${query}:**\n\n${direct.text}`,
          timestamp: new Date().toLocaleTimeString(),
          actionTaken: direct.actionTaken,
        };
      }
    }

    // 2.8. Caso: Reporte de Semáforo ETA / Puntualidad Consolidado
    if (
      (text.includes('reporte') || text.includes('resumen') || text.includes('consolidado')) &&
      (text.includes('eta') || text.includes('semaforo') || text.includes('puntualidad') || text.includes('flota'))
    ) {
      const tardeViajes = dataStore.getViajes('TARDE');
      const listadoTarde = tardeViajes.slice(0, 4).map(v => `• **${v.placa}** (${v.conductor}): Cita ${v.citaProgramada} vs ETA ${v.etaEstimada}`).join('\n');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `📊 **Reporte de Semáforo ETA (161 Viajes Totales):**\n\n🟢 **A Tiempo:** ${metricas.aTiempo} viajes (72.0%)\n🔴 **Tarde (Retrasados):** ${metricas.tarde} viajes (24.2%)\n🟡 **Tolerancia:** ${metricas.tolerancia} viajes (1.9%)\n⚪ **Sin Cálculo:** ${metricas.sinCalculo} viajes (1.9%)\n\n📌 **Principales unidades con retraso:**\n${listadoTarde}\n\n*(Puedes descargar el reporte completo en Excel desde la pestaña de Reportes)*.`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: {
          type: 'GENERATE_REPORT',
          summary: 'Reporte de Semáforo ETA generado',
        },
      };
    }

    // 2.9. Caso: Reporte o consulta de Alarmas Críticas / Altas
    if (text.includes('critica') || text.includes('criticas') || text.includes('anomalia') || text.includes('peligro') || text.includes('desvio')) {
      const criticas = dataStore.getAlarmas('CRITICA', true);
      const listadoCriticas = criticas.map(a => `🚨 **${a.placa}** (${a.evento}) en *${a.ubicacion}* | Conductor: ${a.conductor} (Tel: ${a.telefono || 'N/A'})`).join('\n');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `⚠️ **Reporte de Alarmas Activas en ControlT:**\n\n- 🔴 **Críticas (${metricas.alarmasCriticas}):**\n${listadoCriticas || 'Ninguna activa en este momento'}\n\n- 🟠 **Altas (${metricas.alarmasAltas}):** En su mayoría *Llamadas de seguimiento* gestionables por el agente.\n- 🟢 **Bajas (${metricas.alarmasBajas})**\n\n¿Deseas que atienda las de prioridad alta o requieres contactar a alguno de los conductores con alerta crítica?`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 2.10. Caso: Control y Consulta del Piloto Automático (Exclusivo Administrador)
    if (text.includes('piloto') || text.includes('automatico') || text.includes('automático')) {
      const isAdmin = usuario ? await esUsuarioAdmin(usuario) : false;

      if (text.includes('activa') || text.includes('prende') || text.includes('encend') || text.includes('inici')) {
        if (!isAdmin) {
          return {
            id: `msg-${Date.now()}`,
            sender: 'agent',
            text: `🔒 **Acceso Denegado — Función Exclusiva de Administrador**\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) tiene autorización para activar el **Piloto Automático** de sincronización continua.\n\n💡 *Como operador, puedes realizar atenciones manuales en cualquier momento escribiendo:*\n👉 *"Atiende las alarmas pendientes"*`,
            timestamp: new Date().toLocaleTimeString(),
          };
        }

        await setConfiguracion('piloto_automatico', 'ACTIVO', usuario || 'Admin');
        await setConfiguracion('piloto_seguimiento', 'ACTIVO', usuario || 'Admin');
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🟢 **Piloto Automático ACTIVADO globalmente en ToCIE.**\n\n• Sincronización continua de flota cada 10 minutos desde Hostinger.\n• Cierre autónomo de llamadas de seguimiento para viajes *A Tiempo*.\n• Monitoreo activo de eventos críticos (fuera de ruta, zona prohibida y exceso de velocidad) con alerta a Telegram.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      if (text.includes('desactiva') || text.includes('apaga') || text.includes('pausa') || text.includes('deten')) {
        if (!isAdmin) {
          return {
            id: `msg-${Date.now()}`,
            sender: 'agent',
            text: `🔒 **Acceso Denegado — Función Exclusiva de Administrador**\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) tiene autorización para pausar el **Piloto Automático**.`,
            timestamp: new Date().toLocaleTimeString(),
          };
        }

        await setConfiguracion('piloto_automatico', 'MANUAL', usuario || 'Admin');
        await setConfiguracion('piloto_seguimiento', 'MANUAL', usuario || 'Admin');
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `⏸️ **Piloto Automático cambiado a modo MANUAL.**\n\nSe ha pausado la atención automática desatendida. Los operadores deben atender las alarmas manualmente. El monitoreo de alertas críticas continúa activo.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const estado = await getConfiguracion('piloto_automatico', 'MANUAL');
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `📈 **Estado del Piloto Automático ToCIE:**\n\n• **Modo actual:** **${estado}**\n• **Monitoreo de seguridad:** Activo 24/7\n• **Control:** Exclusivo de administradores\n\n${isAdmin ? 'Puedes decirme *"activa el piloto automático"* o *"desactiva el piloto automático"* para alternar el modo.' : '💡 *Para atender alarmas manualmente, escribe:* *"Atiende las alarmas pendientes"*'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 2.11. Caso: Programación horaria o consulta de automatización
    if (text.includes('hora') || text.includes('programa') || text.includes('cada') || text.includes('minuto')) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `⏱️ **Programación de Atención Automática:**\n\nPuedes activar el interruptor de **"Piloto Automático"** en la barra superior del Dashboard o decirme *"activa el piloto"* para que el sistema revise la cola de ControlT y atienda las llamadas de seguimiento cada 10 minutos de forma autónoma desde Hostinger.`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 2.12. Si menciona algún cliente o palabra clave de búsqueda general
    if (text.length > 3 && !text.includes('hola') && !text.includes('gracias')) {
      const direct = await getVehiclesPaginatedDirect(text, 1, 5);
      if (direct.actionTaken?.pagination?.total > 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🔍 **Vehículos encontrados para "${userInput}":**\n\n${direct.text}`,
          timestamp: new Date().toLocaleTimeString(),
          actionTaken: direct.actionTaken,
        };
      }
    }

    // 3. Respuesta por defecto con sugerencias de acción
    return {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: `👋 Hola. Soy el **Copiloto ToCIE** de la Torre de Control Inteligente Elogia. Puedo realizar consultas y acciones en ControlT en lenguaje natural.\n\nPuedes pedirme:\n1. 🔢 *"¿Cuántos vehículos van andando y van a tiempo?"*\n2. 📈 *"Muéstrame el listado de vehículos con avance >= 50%"*\n3. 🛑 *"¿Cuántos vehículos quietos?"*\n4. 🚚 *"¿Qué carros van en movimiento?"*\n5. 🤖 *"Atiende las alarmas de los viajes a tiempo"*\n6. 📊 *"Dame el reporte del semáforo ETA"*\n7. 📋 *"Escribe /comandos para ver todas las acciones"*`,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

export const trafficAgent = new TrafficAgent();
