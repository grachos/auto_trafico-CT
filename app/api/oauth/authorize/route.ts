import { NextResponse } from 'next/server';
import { redeemAccessTicket } from '@/lib/mcp-auth-service';
import { createSignedAuthCode, getOAuthClient } from '@/lib/mcp-oauth';
import { verificarORegistrarUsuarioGlobal } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, *',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/oauth/authorize
 * Authorizes a client using a single-use access ticket and issues a signed PKCE authorization code.
 */
export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await request.json().catch(() => ({}));
    const {
      username,
      ticket,
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
    } = body;

    // 1. Mandatory PKCE S256 enforcement
    if (!codeChallenge) {
      return NextResponse.json(
        {
          success: false,
          error: 'PKCE S256 code_challenge es obligatorio para conectores remotos en OAuth 2.1',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (codeChallengeMethod && codeChallengeMethod.toUpperCase() !== 'S256') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se admite el método code_challenge_method=S256',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!username || !ticket) {
      return NextResponse.json(
        { success: false, error: 'Usuario y Ticket de Acceso son requeridos' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!redirectUri) {
      return NextResponse.json(
        { success: false, error: 'redirect_uri es requerido' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanClientId = String(clientId || 'claude').trim();

    // 2. Validate client and redirectUri
    const client = await getOAuthClient(cleanClientId);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Cliente OAuth no registrado o no reconocido' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Verify redirectUri belongs to registered URIs or matches domain
    const isUriAllowed = client.redirectUris.some((allowed) => {
      if (allowed === redirectUri) return true;
      try {
        const u = new URL(redirectUri);
        const a = new URL(allowed);
        return u.origin === a.origin;
      } catch {
        return false;
      }
    });

    if (!isUriAllowed) {
      return NextResponse.json(
        { success: false, error: 'redirect_uri no autorizada para este cliente' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Check user global status
    const estadoGlobal = await verificarORegistrarUsuarioGlobal({
      usuario: cleanUser,
      nombre: cleanUser,
      canal: 'OAUTH',
    });

    if (estadoGlobal.estado === 'INACTIVO') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu usuario se encuentra marcado como INACTIVO en la plataforma.',
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 4. Redeem ticket & create connection
    const redeemResult = await redeemAccessTicket({
      ticket: String(ticket).trim(),
      clientId: cleanClientId,
      clientLabel: client.clientName,
      scope: 'controlt:read controlt:write',
      ip: clientIp,
    });

    if (!redeemResult.success || !redeemResult.connectionId) {
      const errCode = redeemResult.error;
      const userMessage =
        errCode === 'IP_BLOCKED'
          ? 'Demasiados intentos fallidos. Tu dirección IP ha sido bloqueada temporalmente por 15 minutos.'
          : 'Ticket de acceso inválido, vencido o ya utilizado. Genera uno nuevo en /mcp.';

      return NextResponse.json(
        { success: false, error: userMessage, error_code: errCode },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 5. Create signed authorization code (5-min TTL)
    const authCode = createSignedAuthCode({
      connectionId: redeemResult.connectionId,
      username: cleanUser,
      clientId: cleanClientId,
      codeChallenge: String(codeChallenge).trim(),
      redirectUri: String(redirectUri).trim(),
    });

    // 6. Build callback redirect URL
    let redirectUrl = String(redirectUri).trim();
    const separator = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl += `${separator}code=${encodeURIComponent(authCode)}`;
    if (state) {
      redirectUrl += `&state=${encodeURIComponent(state)}`;
    }

    return NextResponse.json(
      { success: true, redirectUrl },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[OAuth Authorize] Unexpected error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error interno en el servidor de autorización' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
