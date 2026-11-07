import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';
import { registrarSesionUsuario, verificarSesionUsuario, registrarAuditoriaDB } from '@/lib/db';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-controlt-user, x-controlt-password, mcp-session-id, *',
};

const MCP_TOOLS = [
  {
    name: 'controlt_login',
    description: 'Inicia sesión con credenciales personales de ControlT (usuario y contraseña) para asociar las operaciones de tráfico a tu cuenta individual.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Usuario o correo de ControlT' },
        password: { type: 'string', description: 'Contraseña de ControlT' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'controlt_get_eta_summary',
    description: 'Obtiene el consolidado en tiempo real de puntualidad y semáforo ETA de los viajes activos (A Tiempo, Tarde, Tolerancia, Sin Cálculo).',
    inputSchema: {
      type: 'object',
      properties: {
        filtro_semaforo: {
          type: 'string',
          enum: ['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA'],
          description: 'Filtro opcional de puntualidad',
        },
      },
    },
  },
  {
    name: 'controlt_get_active_alarms',
    description: 'Consulta las alarmas activas pendientes en ControlT clasificadas por severidad (Crítica, Alta, Media, Baja).',
    inputSchema: {
      type: 'object',
      properties: {
        prioridad: {
          type: 'string',
          enum: ['TODAS', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'],
          description: 'Filtro opcional de severidad',
        },
      },
    },
  },
  {
    name: 'controlt_attend_alarm',
    description: 'Atiende y cierra una alarma en ControlT asignando novedad y redactando observación.',
    inputSchema: {
      type: 'object',
      properties: {
        alarmaId: { type: 'string', description: 'ID de la alarma en ControlT' },
        novedad: { type: 'string', description: 'Novedad a registrar (ej: "En ruta sin novedad alguna")' },
        comentario: { type: 'string', description: 'Observación de seguimiento' },
      },
      required: ['alarmaId', 'novedad', 'comentario'],
    },
  },
  {
    name: 'controlt_batch_attend_on_time',
    description: 'Atiende automáticamente en lote todas las alarmas de seguimiento para vehículos que van A Tiempo.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'controlt_get_current_position',
    description: 'Consulta la posición GPS en vivo, velocidad y último reporte de un vehículo por placa.',
    inputSchema: {
      type: 'object',
      properties: {
        placa: { type: 'string', description: 'Placa del vehículo (ej: KUS253)' },
      },
      required: ['placa'],
    },
  },
  {
    name: 'controlt_get_binnacle',
    description: 'Obtiene la bitácora histórica de eventos y monitoreo de un viaje.',
    inputSchema: {
      type: 'object',
      properties: {
        idMonitoreo: { type: 'string', description: 'ID del viaje o de monitoreo' },
      },
      required: ['idMonitoreo'],
    },
  },
  {
    name: 'controlt_get_attended_alarms',
    description: 'Consulta las últimas alarmas atendidas en ControlT con fecha y operador.',
    inputSchema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cantidad de registros (default: 20)' },
        busqueda: { type: 'string', description: 'Filtro por placa o viaje' },
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
async function executeMcpTool(name: string, args: Record<string, any>, operatorName: string) {
  switch (name) {
    case 'controlt_login': {
      const u = args?.username;
      const p = args?.password;

      if (!u || !p) {
        return { error: 'Debes proporcionar "username" y "password" de ControlT.' };
      }

      const authRes = await controltClient.authenticateUser(u, p);
      if (!authRes.success) {
        return { error: authRes.error || 'Credenciales inválidas en ControlT.' };
      }

      await registrarSesionUsuario({
        usuario: u,
        canal: 'MCP',
        identificador: authRes.token || `mcp-${Date.now()}`,
        token: authRes.token,
        nombre: authRes.userName || u,
      });

      return {
        mensaje: `✅ Sesión iniciada exitosamente para ${authRes.userName || u} en ControlT.`,
        token: authRes.token,
        usuario: u,
        nombre: authRes.userName,
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
        mensaje: `✅ Alarma ${alarmaId} atendida con éxito.`,
        alarma: res,
        operador: operatorName,
      };
    }

    case 'controlt_batch_attend_on_time': {
      const res = dataStore.atenderLoteATiempo(`MCP Batch (${operatorName})`);
      return {
        mensaje: `✅ Se atendieron ${res.total} alarmas en lote para vehículos a tiempo.`,
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
        idMonitoreo: id,
        bitacora: binnacle || [],
      };
    }

    case 'controlt_get_attended_alarms': {
      const limite = Math.min(Number(args?.limite) || 20, 50);
      const search = args?.busqueda || '';
      const attended = controltClient.isConfigured() ? await controltClient.getAttendedAlarms(limite, 1, search) : null;
      return {
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

    // Determinar operador autenticado si envió cabeceras o token
    const authHeader = request.headers.get('authorization') || request.headers.get('x-controlt-token') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const customUser = request.headers.get('x-controlt-user');
    const customPass = request.headers.get('x-controlt-password');

    let operatorName = 'Operador ControlT';

    if (bearerToken) {
      const session = await verificarSesionUsuario('MCP', bearerToken);
      if (session.autenticado) {
        operatorName = session.nombre || session.usuario || 'Operador MCP';
      }
    } else if (customUser && customPass) {
      const authRes = await controltClient.authenticateUser(customUser, customPass);
      if (authRes.success) {
        operatorName = authRes.userName || customUser;
      }
    }

    // 1. Protocolo Oficial MCP JSON-RPC 2.0 (Claude.ai, Cursor, Antigravity)
    if (body.jsonrpc === '2.0' || body.method) {
      const method = body.method;
      const id = body.id ?? null;

      // A. Handshake initialize
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

      // B. Confirmación de inicialización
      if (method === 'notifications/initialized') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
      }

      // C. Ping keep-alive
      if (method === 'ping') {
        return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: CORS_HEADERS });
      }

      // D. Listado de herramientas
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

      // E. Llamada a herramientas (tools/call)
      if (method === 'tools/call') {
        const toolName = body.params?.name;
        const toolArgs = body.params?.arguments || {};

        const toolResult = await executeMcpTool(toolName, toolArgs, operatorName);

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

    // 2. Formato directo simplificado { tool, arguments } (para scripts o pruebas curl)
    const { tool, arguments: args } = body;
    if (!tool) {
      return NextResponse.json(
        {
          status: 'online',
          tools: MCP_TOOLS,
        },
        { headers: CORS_HEADERS }
      );
    }

    const directResult = await executeMcpTool(tool, args || {}, operatorName);
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
