import { controltClient } from './controlt-service';
import { dataStore } from './data-store';
import { getMySqlPool, registrarAuditoriaDB } from './db';
import { ChatMessage } from '@/types';
import { cleanAndFormatAIText } from './format-utils';

export { cleanAndFormatAIText };

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
      description: 'Busca o filtra viajes activos por placa, número de viaje, conductor, cliente, estado del semáforo ETA o estado de movimiento/velocidad. Soporta paginación por tandas.',
      parameters: {
        type: 'object',
        properties: {
          filtroSemaforo: {
            type: 'string',
            enum: ['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA', 'SIN_CALCULO'],
            description: 'Filtro por estado de puntualidad del viaje',
          },
          filtroVelocidad: {
            type: 'string',
            enum: ['TODOS', 'EN_MOVIMIENTO', 'DETENIDO'],
            description: 'Filtro de movimiento: "EN_MOVIMIENTO" para vehículos con velocidad > 0 km/h (andando, rodando, en tránsito); "DETENIDO" para velocidad = 0 km/h (quietos, parados, estacionados).',
          },
          busqueda: {
            type: 'string',
            description: 'Término de búsqueda opcional (placa, viaje, conductor, cliente, ciudad). NUNCA pongas palabras como "movimiento", "andando" o "quieto" aquí, usa filtroVelocidad.',
          },
          pagina: {
            type: 'number',
            description: 'Número de página a consultar (por defecto 1)',
          },
          limite: {
            type: 'number',
            description: 'Cantidad de vehículos por tanda (por defecto 5, máx 10)',
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
  {
    type: 'function',
    function: {
      name: 'consultar_posicion_gps',
      description: 'API HUB: Consulta la posición GPS exacta en tiempo real, velocidad, rumbo y dirección de un vehículo dada su placa (ej: SYU930).',
      parameters: {
        type: 'object',
        properties: {
          placa: { type: 'string', description: 'Placa del vehículo a rastrear' },
        },
        required: ['placa'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_bitacora_viaje',
      description: 'API Binnacle: Consulta la bitácora histórica, línea de tiempo, eventos y novedades registradas para un viaje específico en ControlT.',
      parameters: {
        type: 'object',
        properties: {
          idMonitoreo: { type: 'string', description: 'ID de la orden de monitoreo o viaje (ej: 8279108)' },
        },
        required: ['idMonitoreo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_alarmas_atendidas',
      description: 'API Alarmas Atendidas: Consulta el listado de alarmas que ya han sido atendidas y resueltas en ControlT hoy.',
      parameters: {
        type: 'object',
        properties: {
          busqueda: { type: 'string', description: 'Término de búsqueda opcional' },
          limite: { type: 'number', description: 'Cantidad de registros (por defecto 20)' },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres el Agente de Inteligencia Artificial para la Torre de Control de Tráfico de ControlT.
Supervisas y gestionas más de 170 viajes de transporte de carga pesada en tiempo real para operadores de tráfico y logística.

🚨 REGLAS ESTRICTAS DE VERACIDAD (CERO ALUCINACIÓN):
1. ⛔ CERO ALUCINACIÓN: NUNCA inventes placas, números de viaje, ubicaciones, nombres de conductor ni velocidades. Toda la información debe provenir 100% de los datos reales obtenidos mediante las herramientas. Si no hay datos, dilo honestamente sin inventar.
2. 🚗 VEHÍCULOS EN MOVIMIENTO / ANDANDO / RODANDO: Si el usuario pregunta qué carros o vehículos van en movimiento, andando, en ruta, circulando o con velocidad mayor a cero, DEBES invocar la herramienta 'consultar_viajes' con filtroVelocidad: 'EN_MOVIMIENTO'.
3. 🛑 VEHÍCULOS QUIETOS / DETENIDOS / PARADOS: Si el usuario pregunta qué vehículos están quietos, detenidos, parados, estacionados o con velocidad cero, DEBES invocar la herramienta 'consultar_viajes' con filtroVelocidad: 'DETENIDO'.
4. 🔍 NUNCA coloques términos como "movimiento", "andando", "quieto" o "detenido" dentro del parámetro 'busqueda', ya que 'busqueda' filtra por texto de placas, conductores y clientes. Usa filtroVelocidad.

🚨 REGLAS ESTRICTAS DE FORMATO (OBLIGATORIAS E INQUEBRANTABLES):
1. ⛔ PROHIBIDO TERMINANTEMENTE EL USO DE TABLAS MARKDOWN CON BARRAS (| Columna 1 | Columna 2 | ... |).
   NUNCA devuelvas una tabla. En teléfonos móviles, Telegram y en la barra de chat web las tablas se quiebran, las columnas se superponen y son completamente ilegibles.
2. ✅ UTILIZA EXCLUSIVAMENTE FORMATO DE TARJETAS EJECUTIVAS CON EMOJIS Y VIÑETAS.

FORMATO OBLIGATORIO PARA ALARMAS ATENDIDAS O GESTIONADAS:
Para cada vehículo atendido o consultado, genera una tarjeta individual separada por un salto de línea:

🚛 **[PLACA]** — Viaje \`[NRO_VIAJE]\`
• **Conductor:** [Nombre] | **Cliente:** [Cliente]
• **Ubicación:** [Ubicación actual o carretera] ([Velocidad] km/h)
• **Novedad:** *En ruta sin novedad alguna*
• **Observación:** [Comentario registrado]

FORMATO OBLIGATORIO PARA REPORTE DE SEMÁFORO ETA / PUNTUALIDAD:
📊 **Estado Consolidado de la Flota ([TOTAL] Viajes Activos):**
• 🟢 **A Tiempo:** [N] viajes ([%]%)
• 🔴 **Retrasados / Tarde:** [N] viajes ([%]%)
• 🟡 **En Tolerancia:** [N] viajes ([%]%)
• ⚪ **Sin Cálculo:** [N] viajes ([%]%)

FORMATO OBLIGATORIO PARA ALARMAS CRÍTICAS (EJ. FUERA DE RUTA):
🚨 **[PLACA]** — [Evento] (Viaje \`[NRO_VIAJE]\`)
• **Cliente:** [Cliente]
• **Conductor:** [Nombre] — Tel: [Teléfono o N/A]
• **Ubicación GPS:** [Ubicación exacta] ([Velocidad] km/h)
• ⚠️ **Acción requerida:** Notificar al conductor o despachador inmediatamente.

FORMATO OBLIGATORIO PARA POSICIÓN GPS (HUB):
📍 **Vehículo [PLACA]**
• **Ubicación:** [Dirección / Vía]
• **Velocidad:** [Velocidad] km/h — Rumbo: [Rumbo]
• **Coordenadas:** Lat [lat], Long [lng]
• **Último Reporte:** [Fecha y Hora]

TONO Y DIRECTRICES OPERATIVAS:
- Responde de forma ejecutiva, concisa, profesional y en español claro de operaciones de transporte de carga.
- Para llamadas de seguimiento en viajes a tiempo, aplica siempre la novedad "En ruta sin novedad alguna".
- Nunca atiendas alarmas críticas automáticamente; infórmalas primero para que el operador tome decisión.

PAGINACIÓN Y CONSULTA DE MÚLTIPLES VEHÍCULOS:
- Cuando consultes viajes de un cliente o búsqueda y haya varios vehículos, presenta hasta 5 vehículos por bloque.
- Si la herramienta indica que hay más vehículos ("hayMas": true), incluye al final una nota como:
  📌 *Mostrando [N] de [TOTAL] vehículos. Escribe "Ver más vehículos de [Cliente]" o presiona el botón inferior para ver la siguiente tanda.*`;

export class AIService {
  public lastError: string | null = null;

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
      const key = process.env.GEMINI_API_KEY.trim();
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
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
        let filtroVelocidad = args.filtroVelocidad || 'TODOS';
        let busqueda = (args.busqueda || '').toLowerCase().trim();

        // Limpieza defensiva: si el modelo pasó palabras de velocidad en la búsqueda de texto
        if (busqueda.includes('movimiento') || busqueda.includes('andando') || busqueda.includes('rodando') || busqueda.includes('circulando')) {
          filtroVelocidad = 'EN_MOVIMIENTO';
          busqueda = busqueda.replace(/carros|veh[íi]culos|en\s+movimiento|andando|rodando|circulando/gi, '').trim();
        } else if (busqueda.includes('quieto') || busqueda.includes('detenido') || busqueda.includes('parado') || busqueda.includes('estacionado')) {
          filtroVelocidad = 'DETENIDO';
          busqueda = busqueda.replace(/carros|veh[íi]culos|quietos?|detenidos?|parados?|estacionados?/gi, '').trim();
        }

        const filtro = args.filtroSemaforo || 'TODOS';
        const pagina = Math.max(1, Number(args.pagina) || 1);
        const limite = Math.min(10, Math.max(1, Number(args.limite) || 5));
        const offset = (pagina - 1) * limite;

        if (pool) {
          try {
            let whereClause = ` WHERE 1=1`;
            const params: any[] = [];

            if (filtro !== 'TODOS') {
              whereClause += ` AND semaforo_eta = ?`;
              params.push(filtro);
            }

            if (filtroVelocidad === 'EN_MOVIMIENTO') {
              whereClause += ` AND velocidad_kmh > 0`;
            } else if (filtroVelocidad === 'DETENIDO') {
              whereClause += ` AND (velocidad_kmh = 0 OR velocidad_kmh IS NULL)`;
            }

            if (busqueda) {
              whereClause += ` AND (LOWER(placa) LIKE ? OR LOWER(conductor) LIKE ? OR LOWER(nro_viaje) LIKE ? OR LOWER(cliente) LIKE ? OR LOWER(destino) LIKE ?)`;
              const q = `%${busqueda}%`;
              params.push(q, q, q, q, q);
            }

            const [countRows]: any = await pool.execute(
              `SELECT COUNT(*) as total FROM viajes ${whereClause}`,
              params
            );
            const total = Number(countRows[0]?.total || 0);
            const totalPaginas = Math.max(1, Math.ceil(total / limite));
            const hayMas = pagina < totalPaginas;

            const orderSql = filtroVelocidad === 'EN_MOVIMIENTO'
              ? `ORDER BY velocidad_kmh DESC`
              : `ORDER BY nro_viaje DESC`;

            const [rows]: any = await pool.execute(
              `SELECT nro_viaje, placa, conductor, cliente, origen, destino, semaforo_eta, velocidad_kmh, ubicacion, ultimo_evento 
               FROM viajes ${whereClause} 
               ${orderSql} 
               LIMIT ${Number(limite)} OFFSET ${Number(offset)}`,
              params
            );

            return {
              data: {
                totalEncontrados: total,
                paginaActual: pagina,
                totalPaginas,
                limitePorPagina: limite,
                hayMas,
                filtroVelocidad,
                busqueda: args.busqueda || undefined,
                proximaPagina: hayMas ? pagina + 1 : null,
                viajes: rows,
              },
              actionTaken: hayMas ? {
                type: 'PAGINATION_AVAILABLE',
                summary: `Página ${pagina} de ${totalPaginas} (${total} viajes encontrados)`,
                affectedCount: rows.length,
                pagination: {
                  busqueda: args.busqueda || '',
                  filtroSemaforo: filtro,
                  paginaActual: pagina,
                  proximaPagina: pagina + 1,
                  total,
                  totalPaginas,
                },
              } : undefined,
            };
          } catch (e) {}
        }

        let local = dataStore.getViajes(filtro);
        if (filtroVelocidad === 'EN_MOVIMIENTO') {
          local = local.filter(v => (v.velocidadKmh || 0) > 0);
        } else if (filtroVelocidad === 'DETENIDO') {
          local = local.filter(v => (v.velocidadKmh || 0) === 0);
        }

        if (busqueda) {
          local = local.filter(v =>
            v.placa.toLowerCase().includes(busqueda) ||
            v.conductor.toLowerCase().includes(busqueda) ||
            v.nroViaje.includes(busqueda) ||
            (v.cliente && v.cliente.toLowerCase().includes(busqueda))
          );
        }

        const total = local.length;
        const totalPaginas = Math.max(1, Math.ceil(total / limite));
        const hayMas = pagina < totalPaginas;
        const pageItems = local.slice(offset, offset + limite);

        return {
          data: {
            totalEncontrados: total,
            paginaActual: pagina,
            totalPaginas,
            limitePorPagina: limite,
            hayMas,
            filtroVelocidad,
            busqueda: args.busqueda || undefined,
            proximaPagina: hayMas ? pagina + 1 : null,
            viajes: pageItems,
          },
          actionTaken: hayMas ? {
            type: 'PAGINATION_AVAILABLE',
            summary: `Página ${pagina} de ${totalPaginas} (${total} viajes encontrados)`,
            affectedCount: pageItems.length,
            pagination: {
              busqueda: args.busqueda || '',
              filtroSemaforo: filtro,
              paginaActual: pagina,
              proximaPagina: pagina + 1,
              total,
              totalPaginas,
            },
          } : undefined,
        };
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

            const lote = candidatas.slice(0, 5);
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
                    usuarioOrigen: 'Agente LLM Lote',
                    exitoso: true,
                  });

                  atendidas.push({
                    placa: plate,
                    nroViaje: trip,
                    conductor: driver,
                    cliente: client,
                    ubicacion: address,
                    velocidadKmh: speed,
                    alarmaId: aId,
                    comentario: comment,
                  });
                } catch (e: any) {
                  console.error(`Error atendiendo ${plate}:`, e.message);
                }
              })
            );
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

      case 'consultar_posicion_gps': {
        const placa = args.placa?.trim()?.toUpperCase();
        if (!placa) return { data: { error: 'Placa requerida' } };

        if (controltClient.isConfigured()) {
          try {
            const live = await controltClient.getCurrentPosition(placa);
            if (live) return { data: live };
          } catch (e) {}
        }

        // Fallback a viajes locales/MySQL
        const v = dataStore.getViajes('TODOS').find(x => x.placa.toUpperCase() === placa);
        if (v) {
          return {
            data: {
              placa: v.placa,
              velocidad: v.velocidadKmh,
              ubicacion: v.ubicacion,
              ultimoEvento: v.ultimoEvento,
              conductor: v.conductor,
              nroViaje: v.nroViaje,
            },
          };
        }
        return { data: { message: `No se encontraron coordenadas GPS en vivo para la placa ${placa}` } };
      }

      case 'consultar_bitacora_viaje': {
        const idMonitoreo = args.idMonitoreo;
        if (!idMonitoreo) return { data: { error: 'ID de monitoreo requerido' } };

        if (controltClient.isConfigured()) {
          try {
            const live = await controltClient.getTripBinnacle(idMonitoreo, 20, 1);
            if (live) return { data: live };
          } catch (e) {}
        }
        return { data: { message: `Bitácora no disponible para el ID ${idMonitoreo}` } };
      }

      case 'listar_alarmas_atendidas': {
        const limite = Math.min(Number(args.limite) || 20, 50);
        const search = args.busqueda || '';

        if (controltClient.isConfigured()) {
          try {
            const live = await controltClient.getAttendedAlarms(limite, 1, search);
            if (live) return { data: live?.result || live?.data?.records || live };
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

      const modelsToTry = config.url.includes('google')
        ? [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3-flash', 'gemini-2.5-pro'].filter(Boolean) as string[]
        : [config.model];

      let response: Response | null = null;
      let usedModel = config.model;

      for (const model of modelsToTry) {
        usedModel = model;
        let attempts = 0;
        const maxAttempts = model.includes('3.8') ? 3 : 1;

        while (attempts < maxAttempts) {
          attempts++;
          const res = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify({
              model,
              messages,
              tools: TRAFFIC_TOOLS,
              tool_choice: 'auto',
              temperature: 0.2,
              max_tokens: 2500,
            }),
          });

          if (res.ok) {
            response = res;
            this.lastError = null;
            break;
          } else if (res.status === 503 && attempts < maxAttempts) {
            // Reintento rápido por pico temporal de demanda en Google
            await new Promise(r => setTimeout(r, 1200));
            continue;
          } else {
            const errText = await res.text();
            const shortErr = errText.slice(0, 150).replace(/\n/g, ' ');
            this.lastError = `[${model}: ${res.status} -> ${shortErr}]`;
            console.warn(`[AI Service] Falló ${model} (${res.status}):`, shortErr);
            break;
          }
        }

        if (response) break;
      }

      if (!response) return null;

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
            model: usedModel,
            messages,
            temperature: 0.2,
            max_tokens: 2500,
          }),
        });

        if (finalResponse.ok) {
          const finalJson = await finalResponse.json();
          const finalChoice = finalJson.choices?.[0];
          if (finalChoice?.message?.content) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'agent',
              text: cleanAndFormatAIText(finalChoice.message.content),
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
          text: cleanAndFormatAIText(message.content),
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

