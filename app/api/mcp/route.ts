import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { controltClient } from '@/lib/controlt-service';
import { registrarSesionUsuario, verificarSesionUsuario } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tool, arguments: args, auth } = body;

    // Herramientas MCP disponibles
    if (!tool) {
      return NextResponse.json({
        tools: [
          {
            name: 'controlt_login',
            description: 'Autentica a un operador con sus credenciales de ControlT y devuelve un token de sesión MCP.',
            parameters: {
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
            description: 'Obtiene métricas en tiempo real y viajes agrupados por semáforo ETA.',
          },
          {
            name: 'controlt_get_active_alarms',
            description: 'Lista alarmas activas en ControlT con filtro opcional de prioridad.',
          },
          {
            name: 'controlt_attend_alarm',
            description: 'Atiende una alarma individual registrando novedad y comentario.',
          },
          {
            name: 'controlt_batch_attend_on_time',
            description: 'Atiende en lote todas las alarmas de viajes a tiempo.',
          },
          {
            name: 'controlt_get_current_position',
            description: 'Consulta la posición GPS en vivo de un vehículo por placa.',
          },
          {
            name: 'controlt_get_binnacle',
            description: 'Obtiene la bitácora histórica de monitoreo de un viaje.',
          },
          {
            name: 'controlt_get_attended_alarms',
            description: 'Consulta las últimas alarmas atendidas en ControlT.',
          },
        ],
      });
    }

    // 1. Herramienta de Login para MCP
    if (tool === 'controlt_login') {
      const u = args?.username || auth?.username;
      const p = args?.password || auth?.password;

      if (!u || !p) {
        return NextResponse.json(
          { success: false, error: 'Parámetros "username" y "password" requeridos para autenticación' },
          { status: 400 }
        );
      }

      const authRes = await controltClient.authenticateUser(u, p);
      if (!authRes.success) {
        return NextResponse.json(
          { success: false, error: authRes.error || 'Credenciales de ControlT inválidas' },
          { status: 401 }
        );
      }

      await registrarSesionUsuario({
        usuario: u,
        canal: 'MCP',
        identificador: authRes.token || `mcp-${Date.now()}`,
        token: authRes.token,
        nombre: authRes.userName || u,
      });

      return NextResponse.json({
        success: true,
        message: `Autenticación exitosa para ${authRes.userName || u}`,
        token: authRes.token,
        user: { username: u, name: authRes.userName },
      });
    }

    // 2. Verificación de Seguridad y Autenticación para las demás herramientas
    const authHeader = request.headers.get('authorization') || request.headers.get('x-controlt-token') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const token = bearerToken || args?.token || auth?.token;

    const customUser = request.headers.get('x-controlt-user') || auth?.username;
    const customPass = request.headers.get('x-controlt-password') || auth?.password;

    let isAuthenticated = false;
    let operatorName = 'Operador MCP';

    if (token) {
      const session = await verificarSesionUsuario('MCP', token);
      if (session.autenticado) {
        isAuthenticated = true;
        operatorName = session.nombre || session.usuario || 'Operador MCP';
      }
    } else if (customUser && customPass) {
      const authRes = await controltClient.authenticateUser(customUser, customPass);
      if (authRes.success) {
        isAuthenticated = true;
        operatorName = authRes.userName || customUser;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: '🔒 Autenticación requerida. Para usar el servidor MCP debes autenticarte primero con tus credenciales de ControlT.',
          hint: 'Ejecuta primero la herramienta "controlt_login" con { username, password } o incluye la cabecera "Authorization: Bearer <token>"',
        },
        { status: 401 }
      );
    }

    // 3. Ejecución de herramientas autenticadas
    switch (tool) {
      case 'controlt_get_eta_summary': {
        const filtro = args?.filtro_semaforo || 'TODOS';
        return NextResponse.json({
          success: true,
          operador: operatorName,
          metricas: dataStore.getMetricas(),
          viajes: dataStore.getViajes(filtro),
        });
      }

      case 'controlt_get_active_alarms': {
        const prioridad = args?.prioridad || 'TODAS';
        return NextResponse.json({
          success: true,
          operador: operatorName,
          alarmas: dataStore.getAlarmas(prioridad, true),
        });
      }

      case 'controlt_attend_alarm': {
        const { alarmaId, novedad, comentario } = args || {};
        const res = dataStore.atenderAlarma(alarmaId, novedad, comentario, `MCP (${operatorName})`);
        if (!res) return NextResponse.json({ success: false, error: 'Alarma no encontrada' }, { status: 404 });
        return NextResponse.json({ success: true, operador: operatorName, alarma: res });
      }

      case 'controlt_batch_attend_on_time': {
        const res = dataStore.atenderLoteATiempo(`MCP Batch (${operatorName})`);
        return NextResponse.json({ success: true, operador: operatorName, total: res.total, atendidas: res.atendidas });
      }

      case 'controlt_get_current_position': {
        const plate = args?.placa || args?.plate;
        if (!plate) return NextResponse.json({ success: false, error: 'Placa requerida' }, { status: 400 });
        const position = controltClient.isConfigured() ? await controltClient.getCurrentPosition(plate) : null;
        return NextResponse.json({ success: true, live: Boolean(position), data: position });
      }

      case 'controlt_get_binnacle': {
        const id = args?.id || args?.idMonitoreo;
        if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
        const binnacle = controltClient.isConfigured() ? await controltClient.getTripBinnacle(id) : null;
        return NextResponse.json({ success: true, live: Boolean(binnacle), data: binnacle });
      }

      case 'controlt_get_attended_alarms': {
        const attended = controltClient.isConfigured() ? await controltClient.getAttendedAlarms() : null;
        return NextResponse.json({ success: true, live: Boolean(attended), data: attended });
      }

      default:
        return NextResponse.json({ success: false, error: `Herramienta desconocida: ${tool}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
