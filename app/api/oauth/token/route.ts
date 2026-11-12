import { NextResponse } from 'next/server';
import {
  verifySignedAuthCode,
  verifyPkce,
  createSignedAccessToken,
  createSignedRefreshToken,
  verifySignedRefreshToken,
} from '@/lib/mcp-oauth';
import { validateConnection } from '@/lib/mcp-auth-service';

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
 * POST /api/oauth/token
 * OAuth 2.1 Token Exchange endpoint with mandatory PKCE verification and refresh tokens.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let grantType = '';
    let code = '';
    let redirectUri = '';
    let clientId = '';
    let codeVerifier = '';
    let refreshToken = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      grantType = (formData.get('grant_type') as string) || '';
      code = (formData.get('code') as string) || '';
      redirectUri = (formData.get('redirect_uri') as string) || '';
      clientId = (formData.get('client_id') as string) || '';
      codeVerifier = (formData.get('code_verifier') as string) || '';
      refreshToken = (formData.get('refresh_token') as string) || '';
    } else {
      const body = await request.json().catch(() => ({}));
      grantType = body.grant_type || '';
      code = body.code || '';
      redirectUri = body.redirect_uri || '';
      clientId = body.client_id || '';
      codeVerifier = body.code_verifier || '';
      refreshToken = body.refresh_token || '';
    }

    // ========================================================
    // Grant Type 1: authorization_code (PKCE S256 mandatory)
    // ========================================================
    if (grantType === 'authorization_code') {
      if (!code) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Parámetro "code" requerido' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (!codeVerifier) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'PKCE "code_verifier" es obligatorio' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // 1. Verify code HMAC signature and expiration
      const codeCheck = verifySignedAuthCode(code);
      if (!codeCheck.valid || !codeCheck.payload) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Código de autorización inválido, adulterado o expirado',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const authData = codeCheck.payload;

      // 2. Verify redirect_uri match
      if (redirectUri && authData.redirect_uri && redirectUri !== authData.redirect_uri) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'redirect_uri no coincide con la solicitud de autorización original',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // 3. Verify PKCE code_verifier against code_challenge
      const pkceValid = verifyPkce(codeVerifier, authData.challenge);
      if (!pkceValid) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Verificación PKCE fallida (code_verifier no coincide)',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // 4. Validate that underlying connection is active in DB
      const connCheck = await validateConnection(authData.conn);
      if (!connCheck.valid) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'La conexión asociada no existe o ha sido revocada',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // 5. Issue HMAC-signed tokens
      const accessToken = createSignedAccessToken({
        connectionId: authData.conn,
        username: authData.user,
        clientId: authData.client,
        scope: 'controlt:read controlt:write',
      });

      const newRefreshToken = createSignedRefreshToken({
        connectionId: authData.conn,
        username: authData.user,
        clientId: authData.client,
      });

      return NextResponse.json(
        {
          access_token: accessToken,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: newRefreshToken,
          scope: 'controlt:read controlt:write',
        },
        { headers: CORS_HEADERS }
      );
    }

    // ========================================================
    // Grant Type 2: refresh_token
    // ========================================================
    if (grantType === 'refresh_token') {
      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Parámetro "refresh_token" requerido' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const refreshCheck = verifySignedRefreshToken(refreshToken);
      if (!refreshCheck.valid || !refreshCheck.payload) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Refresh token inválido o expirado',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const payload = refreshCheck.payload;

      // Validate connection in DB
      const connCheck = await validateConnection(payload.conn);
      if (!connCheck.valid) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'La conexión asociada ha sido revocada o expiró',
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const newAccessToken = createSignedAccessToken({
        connectionId: payload.conn,
        username: payload.sub,
        clientId: payload.client_id,
        scope: 'controlt:read controlt:write',
      });

      const nextRefreshToken = createSignedRefreshToken({
        connectionId: payload.conn,
        username: payload.sub,
        clientId: payload.client_id,
      });

      return NextResponse.json(
        {
          access_token: newAccessToken,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: nextRefreshToken,
          scope: 'controlt:read controlt:write',
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'grant_type debe ser "authorization_code" o "refresh_token"',
      },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[OAuth Token] Unexpected error in token exchange:', err.message);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Error procesando intercambio de tokens' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

