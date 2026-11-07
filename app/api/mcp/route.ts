import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';
import { registrarSesionUsuario, verificarSesionUsuario, registrarAuditoriaDB } from '@/lib/db';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-controlt-user, x-controlt-password, mcp-session-id, *',
};

// Caché en memoria para recordar sesiones activas durante la conversación de ChatGPT / Claude
const activeMcpSessions = new Map<string, { username: string; name: string; token: string; timestamp: number }>();

const MCP_TOOLS = [
  {
    name: 'controlt_login',
    description: '🔑 HERRAMIENTA OBLIGATORIA DE AUTENTICACIÓN: Inicia sesión con las credenciales de ControlT del operador (usuario/correo y contraseña). DEBES solicitar las credenciales al usuario y ejecutar esta herramienta ANTES de consultar cualquier dato de la flota o atender alarmas.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Usuario o correo de ControlT del operador' },
        password: { type: 'string', description: 'Contraseña de ControlT del operador' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'controlt_get_eta_summary',
    description: '🔒 REQUIERE AUTENTICACIÓN: Obtiene el consolidado en tiempo real de puntualidad y semáforo ETA de los viajes activos (A Tiempo, Tarde, Tolerancia, Sin Cálculo). Si el usuario no ha iniciado sesión, debes solicitarle sus credenciales de ControlT y llamar primero a controlt_login.',
    inputSchema: {
      type: 'object',
      properties: {
        filtro_semaforo: {
          type: 'string',
          enum: ['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA'],
          description: 'Filtro opcional de puntualidad',
        },
        token: {
          type: 'string',
          description: 'Token de sesión opcional obtenido tras ejecutar controlt_login',
        },
      },
    },
  },
  {
    name: 'controlt_get_active_alarms',
    description: '🔒 REQUIERE AUTENTICACIÓN: Consulta las alarmas activas pendientes en ControlT clasificadas por severidad (Crítica, Alta, Media, Baja). Si el usuario no ha iniciado sesión, solicita sus credenciales de ControlT y ejecuta controlt_login primero.',
    inputSchema: {
      type: 'object',
      properties: {
        prioridad: {
          type: 'string',
          enum: ['TODAS', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'],
          description: 'Filtro opcional de severidad',
        },
        token: {
          type: 'string',
          description: 'Token de sesión opcional obtenido tras ejecutar controlt_login',
        },
      },
    },
  },
  {
    name: 'controlt_attend_alarm',
    description: '🔒 REQUIERE AUTENTICACIÓN: Atiende y cierra una alarma en ControlT asignando novedad y redactando observación. Requiere que el usuario esté autenticado con su cuenta de ControlT.',
    inputSchema: {
      type: 'object',
      properties: {
        alarmaId: { type: 'string', description: 'ID de la alarma en ControlT' },
        novedad: { type: 'string', description: 'Novedad a registrar (ej: "En ruta sin novedad alguna")' },
        comentario: { type: 'string', description: 'Observación de seguimiento' },
        token: { type: 'string', description: 'Token de sesión opcional obtenido con controlt_login' },
      },
      required: ['alarmaId', 'novedad', 'comentario'],
    },
  },
  {
    name: 'controlt_batch_attend_on_time',
    description: '🔒 REQUIERE AUTENTICACIÓN: Atiende automáticamente en lote todas las alarmas de seguimiento para vehículos que van A Tiempo. Requiere que el usuario esté autenticado con su cuenta de ControlT.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token de sesión opcional obtenido con controlt_login' },
      },
    },
  },
  {
    name: 'controlt_get_current_position',
    description: '🔒 REQUIERE AUTENTICACIÓN: Consulta la posición GPS en vivo, velocidad y último reporte de un vehículo por placa. Requiere autenticación con controlt_login.',
    inputSchema: {
      type: 'object',
      properties: {
        placa: { type: 'string', description: 'Placa del vehículo (ej: KUS253)' },
        token: { type: 'string', description: 'Token de sesión opcional obtenido con controlt_login' },
      },
      required: ['placa'],
    },
  },
  {
    name: 'controlt_get_binnacle',
    description: '🔒 REQUIERE AUTENTICACIÓN: Obtiene la bitácora histórica de eventos y monitoreo de un viaje. Requiere autenticación con controlt_login.',
    inputSchema: {
      type: 'object',
      properties: {
        idMonitoreo: { type: 'string', description: 'ID del viaje o de monitoreo' },
        token: { type: 'string', description: 'Token de sesión opcional obtenido con controlt_login' },
      },
      required: ['idMonitoreo'],
    },
  },
  {
    name: 'controlt_get_attended_alarms',
    description: '🔒 REQUIERE AUTENTICACIÓN: Consulta las últimas alarmas atendidas en ControlT con fecha y operador. Requiere autenticación con controlt_login.',
    inputSchema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cantidad de registros (default: 20)' },
        busqueda: { type: 'string', description: 'Filtro por placa o viaje' },
        token: { type: 'string', description: 'Token de sesión opcional obtenido con controlt_login' },
      },
    },
  },
];

// Preflight CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Handshake GET (Soporta SSE y comprobación de estado MCP)
export async function GET(request: Request) {
  const accept = request.headers.get('accept') || '';

  // 1. Si el cliente MCP solicita stream SSE
  if (accept.includes('text/event-stream')) {
    const encoder = new TextEncoder();
    const sessionId = `mcp-session-${Date.now()}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  }

  // 2. Respuesta estándar de metadata MCP (para validación de URL en Claude/ChatGPT)
  return NextResponse.json(
    {
      name: 'ControlT Traffic MCP Server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      status: 'online',
      authentication: 'user-required',
      transport: 'streamable-http',
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        prompts: {},
      },
      tools: MCP_TOOLS,
    },
    { headers: CORS_HEADERS }
  );
}

// Ejecución de herramientas MCP
async function executeMcpTool(name: string, args: Record<string, any>, operatorName: string, sessionId?: string) {
  switch (name) {
    case 'controlt_login': {
      const u = args?.username?.trim();
      const p = args?.password?.trim();

      if (!u || !p) {
        return {
          error: 'Credenciales incompletas: Por favor proporciona tu "username" (correo o usuario) y "password" de ControlT.',
        };
      }

      const authRes = await controltClient.authenticateUser(u, p);
      if (!authRes.success) {
        return {
          error: `❌ Error de autenticación en ControlT: ${authRes.error || 'Credenciales incorrectas. Verifica tu usuario y contraseña de ControlT.'}`,
        };
      }

      const sessionToken = authRes.token || `mcp-token-${Date.now()}`;
      const finalName = authRes.userName || u;

      await registrarSesionUsuario({
        usuario: u,
        canal: 'MCP',
        identificador: sessionToken,
        token: authRes.token,
        nombre: finalName,
      });

      // Guardar en caché activa por sessionId si existe
      if (sessionId) {
        activeMcpSessions.set(sessionId, {
          username: u,
          name: finalName,
          token: sessionToken,
          timestamp: Date.now(),
        });
      }

      return {
        mensaje: `✅ ¡Autenticación exitosa! Bienvenido(a) ${finalName} a la Torre de Control ControlT. Tu sesión ha quedado activa. Ya puedes realizar consultas de viajes y atender alarmas.`,
        token: sessionToken,
        usuario: u,
        nombre: finalName,
      };
    }

    case 'controlt_get_eta_summary': {
      const filtro = args?.filtro_semaforo || 'TODOS';
      return {
        operador: operatorName,
        metricas: dataStore.getMetricas(),
        viajes: dataStore.getViajes(filtro).slice(0, 30),
      };
    }

    case 'controlt_get_active_alarms': {
      const prioridad = args?.prioridad || 'TODAS';
      return {
        operador: operatorName,
        alarmas: dataStore.getAlarmas(prioridad, true),
      };
    }

    case 'controlt_attend_alarm': {
      const { alarmaId, novedad, comentario } = args || {};
      const res = dataStore.atenderAlarma(alarmaId, novedad, comentario, `MCP (${operatorName})`);
      if (!res) return { error: `Alarma ${alarmaId} no encontrada o ya atendida.` };

      await registrarAuditoriaDB({
        alarmaId,
        placa: res.placa,
        nroViaje: res.nroViaje,
        novedad,
        comentario,
        canalOrigen: 'MCP_AGENT',
        usuarioOrigen: operatorName,
      });

      return {
        mensaje: `✅ Alarma ${alarmaId} atendida con éxito por el operador ${operatorName}.`,
        alarma: res,
        operador: operatorName,
      };
    }

    case 'controlt_batch_attend_on_time': {
      const res = dataStore.atenderLoteATiempo(`MCP Batch (${operatorName})`);
      return {
        mensaje: `✅ Se atendieron ${res.total} alarmas en lote para vehículos a tiempo. Acción atribuida al operador ${operatorName}.`,
        total: res.total,
        atendidas: res.atendidas,
        operador: operatorName,
      };
    }

    case 'controlt_get_current_position': {
      const plate = args?.placa || args?.plate;
      if (!plate) return { error: 'Placa requerida' };
      const position = controltClient.isConfigured() ? await controltClient.getCurrentPosition(plate) : null;
      return {
        operador: operatorName,
        placa: plate.toUpperCase(),
        enVivo: Boolean(position),
        posicion: position || 'Sin telemetría reciente',
      };
    }

    case 'controlt_get_binnacle': {
      const id = args?.idMonitoreo || args?.id;
      if (!id) return { error: 'ID de monitoreo requerido' };
      const binnacle = controltClient.isConfigured() ? await controltClient.getTripBinnacle(id) : null;
      return {
        operador: operatorName,
        idMonitoreo: id,
        bitacora: binnacle || [],
      };
    }

    case 'controlt_get_attended_alarms': {
      const limite = Math.min(Number(args?.limite) || 20, 50);
      const search = args?.busqueda || '';
      const attended = controltClient.isConfigured() ? await controltClient.getAttendedAlarms(limite, 1, search) : null;
      return {
        operador: operatorName,
        limite,
        busqueda: search,
        alarmasAtendidas: attended || dataStore.getHistorial().slice(0, limite),
      };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

// POST endpoint compatible con MCP JSON-RPC 2.0 y formato directo
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || request.headers.get('mcp-session-id') || undefined;

    // Determinar operador autenticado si envió cabeceras o token
    const authHeader = request.headers.get('authorization') || request.headers.get('x-controlt-token') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const customUser = request.headers.get('x-controlt-user');
    const customPass = request.headers.get('x-controlt-password');

    let isAuthenticated = false;
    let operatorName = '';

    // 1. Revisar si envió token en cabecera Authorization
    if (bearerToken) {
      const session = await verificarSesionUsuario('MCP', bearerToken);
      if (session.autenticado) {
        isAuthenticated = true;
        operatorName = session.nombre || session.usuario || 'Operador MCP';
      }
    }

    // 2. Revisar si envió credenciales fijas en cabeceras
    if (!isAuthenticated && customUser && customPass) {
      const authRes = await controltClient.authenticateUser(customUser, customPass);
      if (authRes.success) {
        isAuthenticated = true;
        operatorName = authRes.userName || customUser;
      }
    }

    // 3. Revisar si la sesión ya fue autenticada en esta conversación vía sessionId
    if (!isAuthenticated && sessionId && activeMcpSessions.has(sessionId)) {
      const active = activeMcpSessions.get(sessionId)!;
      isAuthenticated = true;
      operatorName = active.name;
    }

    // 4. Revisar si la herramienta envió un token en sus argumentos
    const toolArgs = body.params?.arguments || body.arguments || {};
    if (!isAuthenticated && toolArgs.token) {
      const session = await verificarSesionUsuario('MCP', toolArgs.token);
      if (session.autenticado) {
        isAuthenticated = true;
        operatorName = session.nombre || session.usuario || 'Operador MCP';
      }
    }

    // A. Protocolo Oficial MCP JSON-RPC 2.0 (Claude.ai, Cursor, ChatGPT)
    if (body.jsonrpc === '2.0' || body.method) {
      const method = body.method;
      const id = body.id ?? null;

      // 1. Handshake initialize
      if (method === 'initialize') {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'ControlT Traffic MCP',
                version: '1.0.0',
              },
            },
          },
          { headers: CORS_HEADERS }
        );
      }

      // 2. Confirmación de inicialización
      if (method === 'notifications/initialized') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
      }

      // 3. Ping keep-alive
      if (method === 'ping') {
        return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: CORS_HEADERS });
      }

      // 4. Listado de herramientas
      if (method === 'tools/list') {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              tools: MCP_TOOLS,
            },
          },
          { headers: CORS_HEADERS }
        );
      }

      // 5. Llamada a herramientas (tools/call)
      if (method === 'tools/call') {
        const toolName = body.params?.name;
        const args = body.params?.arguments || {};

        // SI NO ESTÁ AUTENTICADO Y NO ES LA HERRAMIENTA DE LOGIN:
        // BLOQUEO ESTRICTO DE SEGURIDAD. Exige al LLM pedir credenciales.
        if (toolName !== 'controlt_login' && !isAuthenticated) {
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: '🔒 ACCESO DENEGADO - AUTENTICACIÓN REQUERIDA:\n\nEl usuario aún no ha iniciado sesión con sus credenciales de ControlT.\n\nPara poder consultar el semáforo ETA, ver viajes o atender alarmas, DEBES solicitar al usuario su usuario (o correo) y su contraseña de ControlT, y luego ejecutar la herramienta "controlt_login" enviando { "username": "<usuario>", "password": "<contraseña>" }.\n\nPor favor pide las credenciales al usuario ahora.',
                  },
                ],
              },
            },
            { headers: CORS_HEADERS }
          );
        }

        const toolResult = await executeMcpTool(toolName, args, operatorName, sessionId);

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2),
                },
              ],
              isError: Boolean(toolResult.error),
            },
          },
          { headers: CORS_HEADERS }
        );
      }

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Método desconocido: ${method}`,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // B. Formato directo simplificado { tool, arguments }
    const { tool, arguments: args } = body;
    if (!tool) {
      return NextResponse.json(
        {
          status: 'online',
          authentication: 'user-required',
          tools: MCP_TOOLS,
        },
        { headers: CORS_HEADERS }
      );
    }

    if (tool !== 'controlt_login' && !isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: '🔒 Autenticación requerida. Debes ejecutar la herramienta "controlt_login" con tus credenciales de ControlT.',
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const directResult = await executeMcpTool(tool, args || {}, operatorName, sessionId);
    return NextResponse.json(
      {
        success: !directResult.error,
        ...directResult,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: err.message,
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
