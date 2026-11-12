import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verificarSesionUsuario, verificarEstadoUsuario } from '@/lib/db';
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
        return { username: session.usuario.trim().toLowerCase(), role: estadoGlobal.rol };
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
 * Lists all active (non-revoked) AI assistant connections for the authenticated user.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Inicia sesión para ver tus conexiones' },
      { status: 401 }
    );
  }

  const connections = await listActiveConnections(user.username);
  return NextResponse.json({
    success: true,
    user: user.username,
    connections,
  });
}

/**
 * POST /api/mcp/connections
 * Generates a one-time, 15-minute access ticket for authorizing Claude or ChatGPT.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Inicia sesión para generar tickets' },
      { status: 401 }
    );
  }

  const result = await createAccessTicket(user.username);
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
    user: user.username,
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
    connectionId,
  });
}

