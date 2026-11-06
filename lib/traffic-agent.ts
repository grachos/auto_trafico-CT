import { dataStore } from './data-store';
import { aiService } from './ai-service';
import { ChatMessage } from '@/types';

export class TrafficAgent {
  /**
   * Procesa el mensaje del usuario (desde la app web, Telegram o MCP)
   * utilizando el LLM conectado (OpenAI o Gemini) si está configurado,
   * o el motor de reglas determinístico como respaldo.
   */
  public async processMessage(userInput: string, sender: 'user' = 'user'): Promise<ChatMessage> {
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

    // 5. Caso: Programación horaria o consulta de automatización
    if (text.includes('hora') || text.includes('programa') || text.includes('cada') || text.includes('minuto')) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: `⏱️ **Programación de Atención Automática:**\n\nPuedes activar el interruptor de **"Piloto Automático"** en la barra superior del Dashboard para que el sistema revise la cola de ControlT y atienda las llamadas de seguimiento cada 15 minutos de forma autónoma.\n\nTambién puedo recibir instrucciones programadas desde webhooks de WhatsApp o Instagram.`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    // 6. Respuesta por defecto con sugerencias de acción
    return {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: `👋 Hola. Soy el **Agente de Torre de Control de Tráfico**. Puedo realizar acciones en ControlT por ti mediante texto libre. \n\nPuedes pedirme:\n1. 🤖 *"Atiende las alarmas de los viajes a tiempo"*\n2. 📊 *"Dame el reporte del semáforo ETA"*\n3. 🚨 *"¿Cuáles son las alarmas críticas activas?"*\n4. 🚛 *"Atiende la alarma del viaje 0101226621"*\n5. ⏱️ *"Activa el piloto automático"*`,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

export const trafficAgent = new TrafficAgent();

