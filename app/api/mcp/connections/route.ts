import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verificarSesionUsuario,
  verificarEstadoUsuario,
  listarUsuariosParaAdmin,
  esUsuarioAdmin,
} from '@/lib/db';
import {
  createAccessTicket,
  listActiveConnections,
  revokeConnection,
} from '@/lib/mcp-auth-service';

export const dynamic = 'force-dynamic';

/**
 * Helper to identify the authenticated user either from session cookie or admin token.
 */
async function getAuthenticatedUser(request: Request): Promise<{ username: string; role: string } | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('ct_session_token')?.value;

  if (sessionToken) {
    const session = await verificarSesionUsuario('WEB', sessionToken);
    if (session.autenticado && session.usuario) {
      const estadoGlobal = await verificarEstadoUsuario(session.usuario);
      if (estadoGlobal.estado !== 'INACTIVO') {
        const isAdmin = await esUsuarioAdmin(session.usuario);
        return { username: session.usuario.trim().toLowerCase(), role: isAdmin ? 'ADMIN' : estadoGlobal.rol };
      }
    }
  }

  // Admin fallback via Bearer header or query param
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === process.env.MCP_ADMIN_API_KEY) {
      const url = new URL(request.url);
      const targetUser = url.searchParams.get('user') || 'ggomez@elogia.com.co';
      return { username: targetUser.trim().toLowerCase(), role: 'ADMIN' };
    }
  }

  return null;
}

/**
 * GET /api/mcp/connections
 * Lists all active (non-revoked) AI assistant connections.
 * Admins see all active connections across users plus registered operators.
 * Operators see only their own active connections.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Inicia sesión para ver tus conexiones' },
      { status: 401 }
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const connections = await listActiveConnections(isAdmin ? undefined : user.username);

  let registeredUsers: any[] = [];
  if (isAdmin) {
    try {
      registeredUsers = await listarUsuariosParaAdmin(user.username);
    } catch {
      registeredUsers = [];
    }
  }

  return NextResponse.json({
    success: true,
    user: user.username,
    role: user.role,
    isAdmin,
    connections,
    registeredUsers: registeredUsers.map((u: any) => ({
      usuario: u.usuario,
      nombre: u.nombre,
      estado: u.estado,
      rol: u.rol,
    })),
  });
}

/**
 * POST /api/mcp/connections
 * Generates a one-time, 15-minute access ticket for a registered ControlT user.
 * SECURITY RULE: Only administrators can generate access tickets!
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Inicia sesión para generar tickets' },
      { status: 401 }
    );
  }

  // Enforce: Only Admins can generate access tickets
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: 'Acceso restringido: Solo los administradores pueden generar tickets de acceso MCP para los operadores.',
      },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body was empty or not JSON
  }

  const targetUser = (body.targetUser || body.username || user.username).trim().toLowerCase();
  if (!targetUser) {
    return NextResponse.json(
      { error: 'INVALID_PARAMETER', message: 'Debes especificar el usuario de ControlT para quien se genera el ticket.' },
      { status: 400 }
    );
  }

  // Validate that the target user is registered in ControlT / ToCIE and active
  const estado = await verificarEstadoUsuario(targetUser);
  const masterAdmin = (process.env.CONTROLT_USERNAME || 'ggomez@elogia.com.co').toLowerCase().trim();
  const isMaster = targetUser === 'ggomez@elogia.com.co' || targetUser === masterAdmin;

  if (!estado.existe && !isMaster) {
    return NextResponse.json(
      {
        error: 'USER_NOT_FOUND',
        message: `El operador "${targetUser}" no se encuentra registrado en el sistema ToCIE / ControlT. Debe estar registrado previamente.`,
      },
      { status: 404 }
    );
  }

  if (estado.estado === 'INACTIVO') {
    return NextResponse.json(
      {
        error: 'USER_INACTIVE',
        message: `El usuario "${targetUser}" se encuentra en estado INACTIVO en la plataforma.`,
      },
      { status: 400 }
    );
  }

  const result = await createAccessTicket(targetUser);
  if ('error' in result) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.error === 'RATE_LIMIT_EXCEEDED' ? 429 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ticket: result.ticket,
    expiresAt: result.expiresAt,
    targetUser,
    generatedBy: user.username,
  });
}

/**
 * DELETE /api/mcp/connections
 * Revokes an active connection immediately.
 */
export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Inicia sesión para revocar conexiones' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  let connectionId = url.searchParams.get('id');

  if (!connectionId) {
    try {
      const body = await request.json();
      connectionId = body.id || body.connectionId;
    } catch {
      // Body was not JSON
    }
  }

  if (!connectionId) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Se requiere el id de la conexión a revocar' },
      { status: 400 }
    );
  }

  // Admins can revoke any connection; operators can only revoke their own connections
  const revoked = await revokeConnection(connectionId, user.role === 'ADMIN' ? undefined : user.username);
  if (!revoked) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Conexión no encontrada o ya revocada' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Conexión revocada exitosamente',
  });
}
