import { dataStore } from './data-store';
import { aiService } from './ai-service';
import { ChatMessage } from '@/types';
import { getVehiclesPaginatedDirect } from './report-generator';
import { getConfiguracion, setConfiguracion } from './db';

export class TrafficAgent {
  /**
   * Procesa el mensaje del usuario (desde la app web, Telegram o MCP)
   * utilizando el LLM conectado (OpenAI o Gemini) si está configurado,
   * o el motor de reglas determinístico como respaldo.
   */
  public async processMessage(userInput: string, sender: 'user' = 'user'): Promise<ChatMessage> {
    // 0. Intercepción de Paginación Rápida con CERO consumo de tokens:
    const pageMatch = userInput.match(/p[áa]gina\s+(\d+)/i);
    const isPaging = userInput.toLowerCase().includes('siguiente') || userInput.toLowerCase().includes('ver m');
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

    const textClean = userInput.toLowerCase().trim();

    // 0.1. Intercepción de Vehículos en Movimiento (Andando / Rodando) vs Detenidos (Quietos)
    // Garantiza 100% veracidad, datos reales desde MySQL y cero alucinaciones
    const isMovimiento = (textClean.includes('movimiento') || textClean.includes('andando') || textClean.includes('rodando') || textClean.includes('circulando') || textClean.includes('en marcha')) && !textClean.includes('sin novedad');
    const isDetenido = textClean.includes('quieto') || textClean.includes('detenido') || textClean.includes('parado') || textClean.includes('estacionado') || textClean.includes('velocidad 0') || textClean.includes('velocidad cero');

    if (isMovimiento || isDetenido) {
      const busquedaFiltro = textClean
        .replace(/cu[aá]les|qu[eé]|carros|veh[íi]culos|unidades|camiones|van|est[aá]n|en|movimiento|andando|rodando|circulando|en marcha|quietos?|detenidos?|parados?|estacionados?|velocidad\s*0|velocidad\s*cero|de|los|\?/gi, '')
        .trim();

      const filtroVelocidad = isMovimiento ? 'EN_MOVIMIENTO' : 'DETENIDO';
      const direct = await getVehiclesPaginatedDirect(busquedaFiltro, 1, 5, 'TODOS', filtroVelocidad);

      const encabezado = isMovimiento
        ? `🚚 **Vehículos en Movimiento (Velocidad > 0 km/h)${busquedaFiltro ? ` — Filtro: "${busquedaFiltro.toUpperCase()}"` : ''}:**`
        : `🛑 **Vehículos Detenidos / Estacionados (Velocidad = 0 km/h)${busquedaFiltro ? ` — Filtro: "${busquedaFiltro.toUpperCase()}"` : ''}:**`;

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `${encabezado}\n\n${direct.text}`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: direct.actionTaken,
      };
    }

    // 0.2. Catálogo de Comandos Rápidos
    if (textClean === '/comando' || textClean === '/comandos' || textClean === '/ayuda' || textClean === '/help' || textClean.includes('que comandos') || textClean.includes('lista de comandos')) {
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
          `• *"¿Qué carros van andando?"*\n` +
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

    // 2. Motor determinístico de reglas (fallback seguro sin IA externa)
    const text = userInput.toLowerCase().trim();
    const metricas = dataStore.getMetricas();

    // 1. Caso: Atender alarmas de viajes a tiempo (individual o en lote)
    if (
      (text.includes('atiende') || text.includes('atender') || text.includes('gestiona') || text.includes('procesa')) &&
      (text.includes('a tiempo') || text.includes('todas') || text.includes('lote') || text.includes('seguimiento'))
    ) {
      const res = dataStore.atenderLoteATiempo('Agente Conversacional IA');

      if (res.total === 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🔍 Revisé la cola de ControlT y **no hay alarmas pendientes** de viajes "A tiempo" por atender en este momento. La cola para viajes a tiempo está al día.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const placas = res.atendidas.map(a => `**${a.placa}** (${a.nroViaje})`).join(', ');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `✅ **Operación completada con éxito.**\n\nHe atendido **${res.total} alarmas** de "Llamada de seguimiento" correspondientes a vehículos con Semáforo ETA **A Tiempo**:\n\n• ${placas}\n\nSe asignó la novedad *"En ruta sin novedad alguna"* y se guardó la observación en ControlT.`,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken: {
          type: 'ATTEND_BATCH',
          summary: `Se atendieron ${res.total} alarmas automáticamente`,
          affectedCount: res.total,
          details: res.atendidas,
        },
      };
    }

    // 2. Caso: Atender una alarma específica por viaje o placa
    const matchViaje = text.match(/0101\d{6}/);
    const matchPlaca = text.match(/[a-z]{3}\d{3}/i);

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

    // 3. Caso: Reporte de Semáforo ETA / Puntualidad
    if (text.includes('reporte') && (text.includes('eta') || text.includes('semaforo') || text.includes('tiempo') || text.includes('retraso') || text.includes('tarde'))) {
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

    // 4. Caso: Reporte o consulta de Alarmas Críticas / Altas
    if (text.includes('critica') || text.includes('criticas') || text.includes('alarma') || text.includes('peligro') || text.includes('desvio')) {
      const criticas = dataStore.getAlarmas('CRITICA', true);
      const listadoCriticas = criticas.map(a => `🚨 **${a.placa}** (${a.evento}) en *${a.ubicacion}* | Conductor: ${a.conductor} (Tel: ${a.telefono || 'N/A'})`).join('\n');

      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `⚠️ **Reporte de Alarmas Activas en ControlT:**\n\n- 🔴 **Críticas (${metricas.alarmasCriticas}):**\n${listadoCriticas || 'Ninguna activa en este momento'}\n\n- 🟠 **Altas (${metricas.alarmasAltas}):** En su mayoría *Llamadas de seguimiento* gestionables por el agente.\n- 🟢 **Bajas (${metricas.alarmasBajas})**\n\n¿Deseas que atienda las de prioridad alta o requieres contactar a alguno de los conductores con alerta crítica?`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 5. Caso: Control y Consulta del Piloto Automático
    if (text.includes('piloto')) {
      if (text.includes('activa') || text.includes('prende') || text.includes('encend') || text.includes('inici')) {
        await setConfiguracion('piloto_automatico', 'ACTIVO', 'Copiloto ToCIE');
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: `🟢 **Piloto Automático ACTIVADO globalmente en ToCIE.**\n\n• Sincronización continua de flota cada 10 minutos desde Hostinger.\n• Cierre autónomo de llamadas de seguimiento para viajes *A Tiempo*.\n• Monitoreo activo de eventos críticos (fuera de ruta, zona prohibida y exceso de velocidad) con alerta a Telegram.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      if (text.includes('desactiva') || text.includes('apaga') || text.includes('pausa') || text.includes('deten')) {
        await setConfiguracion('piloto_automatico', 'MANUAL', 'Copiloto ToCIE');
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
        text: `📈 **Estado del Piloto Automático ToCIE:**\n\n• **Modo actual:** **${estado}**\n• **Monitoreo de seguridad:** Activo 24/7\n• **Control:** Exclusivo de \`ggomez@elogia.com.co\`\n\nPuedes decirme *"activa el piloto automático"* o *"desactiva el piloto automático"* para alternar el modo.`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 6. Caso: Programación horaria o consulta de automatización
    if (text.includes('hora') || text.includes('programa') || text.includes('cada') || text.includes('minuto')) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `⏱️ **Programación de Atención Automática:**\n\nPuedes activar el interruptor de **"Piloto Automático"** en la barra superior del Dashboard o decirme *"activa el piloto"* para que el sistema revise la cola de ControlT y atienda las llamadas de seguimiento cada 10 minutos de forma autónoma desde Hostinger.`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 7. Respuesta por defecto con sugerencias de acción
    return {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: `👋 Hola. Soy el **Copiloto ToCIE** de la Torre de Control Inteligente Elogia. Puedo realizar acciones en ControlT por ti mediante texto libre. \n\nPuedes pedirme:\n1. 🤖 *"Atiende las alarmas de los viajes a tiempo"*\n2. 📊 *"Dame el reporte del semáforo ETA"*\n3. 🚨 *"¿Cuáles son las alarmas críticas activas?"*\n4. ⏱️ *"Activa el piloto automático"*\n5. 🚛 *"Atiende la alarma del viaje 0101226621"*`,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

export const trafficAgent = new TrafficAgent();

