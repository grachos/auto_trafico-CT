import { NextResponse } from 'next/server';
import { registerOAuthClient } from '@/lib/mcp-oauth';

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
 * POST /api/oauth/register (RFC 7591 Dynamic Client Registration)
 * Enables Claude and ChatGPT connectors to register themselves dynamically.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientName = body.client_name || 'AI Assistant Connector';
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

    if (redirectUris.length === 0) {
      return NextResponse.json(
        {
          error: 'invalid_client_metadata',
          error_description: 'redirect_uris must contain at least one valid URI',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const client = await registerOAuthClient({
      clientName,
      redirectUris,
    });

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[OAuth Register] Error registering client:', err.message);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Could not register client' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

