import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, *',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /.well-known/oauth-protected-resource
 * Informs AI clients of the protected resource URL and associated authorization servers.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const metadata = {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ['controlt:read', 'controlt:write'],
    bearer_methods_supported: ['header'],
  };

  return NextResponse.json(metadata, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

