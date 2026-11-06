import { controltClient } from './controlt-service';
import { dataStore } from './data-store';
import { getMySqlPool, registrarAuditoriaDB } from './db';
import { ChatMessage } from '@/types';

export const TRAFFIC_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'obtener_metricas_trafico',
      description: 'Obtiene las métricas consolidadas en tiempo real: total de viajes, viajes a tiempo, tarde, en tolerancia, y total de alarmas críticas y altas.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_alarmas',
      description: 'Consulta las alarmas activas en ControlT con filtro opcional de prioridad.',
      parameters: {
        type: 'object',
        properties: {
          prioridad: {
            type: 'string',
            enum: ['CRITICA', 'ALTA', 'BAJA', 'TODAS'],
            description: 'Prioridad de la alarma a filtrar',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_viajes',
      description: 'Busca o filtra viajes activos por placa, número de viaje, conductor, cliente o estado del semáforo ETA.',
      parameters: {
        type: 'object',
        properties: {
          filtroSemaforo: {
            type: 'string',
            enum: ['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA', 'SIN_CALCULO'],
            description: 'Filtro por estado de puntualidad del viaje',
          },
          busqueda: {
            type: 'string',
            description: 'Término de búsqueda opcional (placa, viaje, conductor, cliente, ciudad)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atender_alarma_individual',
      description: 'Atiende y cierra una alarma específica en ControlT registrando la novedad, comentario y auditoría en MySQL.',
      parameters: {
        type: 'object',
        properties: {
          alarmaId: { type: 'string', description: 'ID de la alarma en ControlT' },
          nroViaje: { type: 'string', description: 'Número del viaje' },
          placa: { type: 'string', description: 'Placa del vehículo' },
          novedad: { type: 'string', description: 'Novedad seleccionada (ej: "En ruta sin novedad alguna")' },
          comentario: { type: 'string', description: 'Observación detallada' },
        },
        required: ['alarmaId', 'nroViaje', 'placa', 'comentario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atender_alarmas_en_lote_a_tiempo',
      description: 'Atiende en lote todas las alarmas de "Llamada de seguimiento" de viajes que van A Tiempo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_historial_auditoria',
      description: 'Consulta las últimas atenciones y novedades registradas en MySQL por el agente.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'number', description: 'Límite de registros (máx 20)' },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres el Agente de Inteligencia Artificial para la Torre de Control de Tráfico de ControlT.
Asistes a los operadores logísticos en la supervisión de más de 170 viajes de transporte de carga en tiempo real.

Reglas de actuación:
1. Responde de forma concisa, profesional y en español latinoamericano claro. Usa formato Markdown (negrita, viñetas, tablas).
2. Usa tus herramientas para consultar datos en vivo siempre que te pregunten sobre la flota, puntualidad (semáforo ETA), conductores o alarmas.
3. Si el usuario te pide atender alarmas o procesar llamadas de seguimiento, ejecuta las herramientas correspondientes.
4. Para alarmas de ALTA prioridad ("Llamada de seguimiento") en viajes "A TIEMPO", aplica la novedad "En ruta sin novedad alguna" con una observación coherente sobre su tránsito normal y velocidad.
5. Para alarmas CRÍTICAS (ej. "FUERA DE RUTA"), nunca las atiendas a ciegas: resalta la ubicación, placa, conductor y sugiere llamar de inmediato.`;

export class AIService {
  public isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  }

  public getProvider(): 'openai' | 'gemini' | null {
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return null;
  }

  private getEndpointAndHeaders(): { url: string; headers: Record<string, string>; model: string } | null {
    if (process.env.OPENAI_API_KEY) {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      };
    }

    if (process.env.GEMINI_API_KEY) {
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GEMINI_API_KEY.trim()}`,
        },
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      };
    }

    return null;
  }

  /**
   * Ejecuta una herramienta localmente cuando el LLM lo solicita
   */
  private async executeTool(name: string, args: Record<string, any>): Promise<{ data: any; actionTaken?: any }> {
    switch (name) {
      case 'obtener_metricas_trafico': {
        const pool = getMySqlPool();
        if (pool) {
          try {
            const [rows]: any = await pool.execute(
              `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN semaforo_eta = 'A_TIEMPO' THEN 1 ELSE 0 END) as aTiempo,
                SUM(CASE WHEN semaforo_eta = 'TARDE' THEN 1 ELSE 0 END) as tarde,
                SUM(CASE WHEN semaforo_eta = 'TOLERANCIA' THEN 1 ELSE 0 END) as tolerancia,
                SUM(CASE WHEN semaforo_eta = 'SIN_CALCULO' THEN 1 ELSE 0 END) as sinCalculo
               FROM viajes`
            );
            const m = rows[0] || {};
            return {
              data: {
                totalViajes: Number(m.total || 0),
                aTiempo: Number(m.aTiempo || 0),
                tarde: Number(m.tarde || 0),
                tolerancia: Number(m.tolerancia || 0),
                sinCalculo: Number(m.sinCalculo || 0),
              },
            };
          } catch (e) {
            // fallback al datastore
          }
        }
        return { data: dataStore.getMetricas() };
      }

      case 'listar_alarmas': {
        const prioridad = args.prioridad || 'TODAS';
        if (controltClient.isConfigured()) {
          try {
            const live = await controltClient.getAlarmsToAttend(50, 1);
            const raw = live?.result || live?.data?.records || [];
            const mapped = raw.map((a: any) => ({
              id: String(a.id_monitoring_orders_alarm || a.id_monitoring_order_alarm || a.idAlarm || a.id),
              prioridad: String(a.priority || a.priorityName || 'ALTA').toUpperCase().includes('CRIT') ? 'CRITICA' : 'ALTA',
              evento: a.alarm_name || a.eventName || 'LLAMADA DE SEGUIMIENTO',
              nroViaje: a.trip_number || a.tripNumber || 'N/A',
              placa: a.license_plate || a.vehiclePlate || 'N/A',
              conductor: a.driver_name || a.driverName || 'Sin conductor',
              ubicacion: a.address || a.current_address_location || 'En ruta',
              velocidadKmh: Number(a.speed || 0),
            }));

            const filtradas = prioridad === 'TODAS' ? mapped : mapped.filter((a: any) => a.prioridad === prioridad);
            return { data: filtradas.slice(0, 15) };
          } catch (e) {}
        }
        return { data: dataStore.getAlarmas(prioridad, true).slice(0, 15) };
      }

      case 'consultar_viajes': {
        const pool = getMySqlPool();
        const busqueda = (args.busqueda || '').toLowerCase();
        const filtro = args.filtroSemaforo || 'TODOS';

        if (pool) {
          try {
            let sql = `SELECT nro_viaje, placa, conductor, cliente, origen, destino, semaforo_eta, velocidad_kmh, ubicacion, ultimo_evento FROM viajes WHERE 1=1`;
            const params: any[] = [];

            if (filtro !== 'TODOS') {
              sql += ` AND semaforo_eta = ?`;
              params.push(filtro);
            }

            if (busqueda) {
              sql += ` AND (LOWER(placa) LIKE ? OR LOWER(conductor) LIKE ? OR LOWER(nro_viaje) LIKE ? OR LOWER(cliente) LIKE ? OR LOWER(destino) LIKE ?)`;
              const q = `%${busqueda}%`;
              params.push(q, q, q, q, q);
            }

            sql += ` LIMIT 15`;
            const [rows]: any = await pool.execute(sql, params);
            return { data: rows };
          } catch (e) {}
        }

        let local = dataStore.getViajes(filtro);
        if (busqueda) {
          local = local.filter(v =>
            v.placa.toLowerCase().includes(busqueda) ||
            v.conductor.toLowerCase().includes(busqueda) ||
            v.nroViaje.includes(busqueda)
          );
        }
        return { data: local.slice(0, 15) };
      }

      case 'atender_alarma_individual': {
        const { alarmaId, nroViaje, placa, novedad, comentario } = args;
        const nov = novedad || 'En ruta sin novedad alguna';
        const com = comentario || 'Vehículo en tránsito normal. Ruta sin novedad alguna.';

        let liveRes = null;
        if (controltClient.isConfigured()) {
          try {
            liveRes = await controltClient.attendAlarm({
              idMonitoringOrdersAlarm: alarmaId,
              numberTrip: nroViaje,
              licensePlate: placa,
              noveltySelected: 1,
              comment: com,
            });
          } catch (e) {}
        }

        dataStore.atenderAlarma(alarmaId, nov, com, 'Agente IA LLM');

        await registrarAuditoriaDB({
          alarmaId: String(alarmaId),
          nroViaje: String(nroViaje),
          placa: String(placa),
          novedad: nov,
          comentario: com,
          canalOrigen: 'WEB_APP',
          usuarioOrigen: 'Agente LLM',
          exitoso: true,
        });

        return {
          data: { status: 'OK', alarmaId, placa, nroViaje, mensaje: 'Alarma atendida y registrada en MySQL' },
          actionTaken: {
            type: 'ATTEND_SINGLE',
            summary: `Alarma ${alarmaId} de placa ${placa} atendida`,
            details: { alarmaId, nroViaje, placa, comentario: com },
          },
        };
      }

      case 'atender_alarmas_en_lote_a_tiempo': {
        let atendidas: any[] = [];

        if (controltClient.isConfigured()) {
          try {
            const live = await controltClient.getAlarmsToAttend(100, 1);
            const raw = live?.result || live?.data?.records || [];
            const candidatas = raw.filter((a: any) => {
              const snp = String(a.state_next_point || a.stateNextPoint || '');
              const desc = String(a.description_state_next_point || '').toUpperCase();
              const ev = String(a.alarm_name || a.eventName || '').toUpperCase();
              return (snp === '1' || desc.includes('A TIEMPO')) && ev.includes('SEGUIMIENTO');
            });

            for (const c of candidatas) {
              const aId = c.id_monitoring_orders_alarm || c.id_monitoring_order_alarm || c.idAlarm || c.id;
              const trip = c.trip_number || c.tripNumber || 'N/A';
              const plate = c.license_plate || c.vehiclePlate || 'N/A';
              const speed = c.speed || 0;
              const address = c.address || c.current_address_location || 'En ruta';
              const comment = `Vehículo en tránsito normal a ${speed} km/h en ${address}. Ruta sin novedad alguna.`;

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
                usuarioOrigen: 'Agente LLM Lote',
                exitoso: true,
              });

              atendidas.push({ placa: plate, nroViaje: trip, alarmaId: aId });
            }
          } catch (e) {}
        }

        if (atendidas.length === 0) {
          const localBatch = dataStore.atenderLoteATiempo('Agente LLM Lote');
          atendidas = localBatch.atendidas;
        }

        return {
          data: { status: 'OK', totalAtendidas: atendidas.length, atendidas },
          actionTaken: {
            type: 'ATTEND_BATCH',
            summary: `Se atendieron ${atendidas.length} alarmas en lote`,
            affectedCount: atendidas.length,
            details: atendidas,
          },
        };
      }

      case 'consultar_historial_auditoria': {
        const pool = getMySqlPool();
        const limite = Math.min(Number(args.limite) || 10, 20);

        if (pool) {
          try {
            const [rows]: any = await pool.execute(
              `SELECT alarma_id, nro_viaje, placa, novedad_aplicada, comentario, canal_origen, created_at 
               FROM atenciones_auditoria 
               ORDER BY id DESC LIMIT ?`,
              [limite]
            );
            return { data: rows };
          } catch (e) {}
        }

        return { data: dataStore.getHistorial().slice(0, limite) };
      }

      default:
        return { data: { error: `Herramienta desconocida: ${name}` } };
    }
  }

  /**
   * Procesa el mensaje con el LLM (OpenAI o Gemini) usando Function Calling
   */
  public async chat(userInput: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<ChatMessage | null> {
    const config = this.getEndpointAndHeaders();
    if (!config) return null;

    try {
      const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory.slice(-6),
        { role: 'user', content: userInput },
      ];

      // 1. Llamada inicial al modelo con las herramientas declaradas
      const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: TRAFFIC_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Service] Error ${response.status} de ${config.model}:`, errorText);
        return null;
      }

      const resJson = await response.json();
      const choice = resJson.choices?.[0];
      if (!choice) return null;

      const message = choice.message;
      let lastActionTaken = undefined;

      // 2. Si el modelo decidió invocar herramientas (Function Calling)
      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);

        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {}

          const { data: toolOutput, actionTaken } = await this.executeTool(fnName, fnArgs);
          if (actionTaken) lastActionTaken = actionTaken;

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolOutput),
          });
        }

        // 3. Segunda llamada para que el modelo redacte la respuesta final con los datos de las herramientas
        const finalResponse = await fetch(config.url, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: 0.2,
            max_tokens: 800,
          }),
        });

        if (finalResponse.ok) {
          const finalJson = await finalResponse.json();
          const finalChoice = finalJson.choices?.[0];
          if (finalChoice?.message?.content) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'agent',
              text: finalChoice.message.content,
              timestamp: new Date().toLocaleTimeString(),
              actionTaken: lastActionTaken,
            };
          }
        }
      }

      // Si el modelo respondió directo sin herramientas
      if (message.content) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text: message.content,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      return null;
    } catch (err: any) {
      console.error('[AI Service] Error en chat:', err.message);
      return null;
    }
  }
}

export const aiService = new AIService();
