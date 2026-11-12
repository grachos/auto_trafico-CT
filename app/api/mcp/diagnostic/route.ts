import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { controltClient } from '../../../../lib/controlt-service';

export const dynamic = 'force-dynamic';

/**
 * Constant-time comparison for authentication tokens to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Extract bearer token from Authorization header or custom header.
 */
function extractAdminToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  const apiKeyHeader = request.headers.get('x-mcp-admin-key');
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }

  return null;
}

/**
 * GET /api/mcp/diagnostic
 * Read-only diagnostic endpoint.
 * Protected by MCP_ADMIN_API_KEY.
 * Never leaks credentials, tokens, or PII (Personally Identifiable Information).
 */
export async function GET(request: Request) {
  const startTime = performance.now();

  const configuredKey = process.env.MCP_ADMIN_API_KEY;
  if (!configuredKey) {
    console.error('[MCP Diagnostic] Error: MCP_ADMIN_API_KEY is not configured');
    return NextResponse.json(
      {
        status: 'error',
        error_code: 'SERVER_MISCONFIGURED',
        message: 'Admin API key is not configured on server',
      },
      { status: 500 }
    );
  }

  const providedToken = extractAdminToken(request);
  if (!providedToken || !secureCompare(providedToken, configuredKey)) {
    console.warn('[MCP Diagnostic] Unauthorized access attempt rejected');
    return NextResponse.json(
      {
        status: 'error',
        error_code: 'UNAUTHORIZED',
        message: 'Invalid or missing admin authorization token',
      },
      { status: 401 }
    );
  }

  // Pre-flight check: Is ControlT configured with credentials?
  if (!controltClient.isConfigured()) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        latency_ms: Math.round(performance.now() - startTime),
        controlt_api: {
          connected: false,
          auth_status: 'unconfigured',
          error_code: 'MISSING_CONTROLT_CREDENTIALS',
        },
      },
      { status: 503 }
    );
  }

  try {
    // 1. Verify authentication against ControlT
    const token = await controltClient.getValidToken();
    if (!token) {
      const lastError = controltClient.getLastError();
      console.warn('[MCP Diagnostic] ControlT authentication failed');
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          latency_ms: Math.round(performance.now() - startTime),
          controlt_api: {
            connected: false,
            auth_status: 'auth_failed',
            error_code: 'CONTROLT_AUTH_FAILED',
          },
        },
        { status: 502 }
      );
    }

    // 2. Query read-only endpoints with size=1 to validate schema and count entities
    const [resumeData, alarmsData] = await Promise.all([
      controltClient.getSummaryTrips(1, 1).catch(() => null),
      controltClient.getAlarmsToAttend(1, 1).catch(() => null),
    ]);

    const totalActiveTrips = Number(
      resumeData?.info?.count ??
      resumeData?.total ??
      (Array.isArray(resumeData?.result) ? resumeData.result.length : 0)
    );

    const pendingAlarmsCount = Number(
      alarmsData?.info?.count ??
      alarmsData?.total ??
      (Array.isArray(alarmsData?.result) ? alarmsData.result.length : 0)
    );

    const resumeMatched = Boolean(
      resumeData && (resumeData.info || Array.isArray(resumeData.result) || Array.isArray(resumeData.data?.records))
    );

    const alarmsMatched = Boolean(
      alarmsData && (alarmsData.info || Array.isArray(alarmsData.result) || Array.isArray(alarmsData.data?.records))
    );

    const elapsedMs = Math.round(performance.now() - startTime);

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        latency_ms: elapsedMs,
        controlt_api: {
          connected: true,
          auth_status: 'authenticated',
          company_id: String(process.env.CONTROLT_COMPANY_ID || '616346'),
        },
        schema_validation: {
          resume_for_ui: {
            status: resumeMatched ? 'match' : 'unexpected_schema',
            total_active_trips: totalActiveTrips,
          },
          alarms_attend_for_ui: {
            status: alarmsMatched ? 'match' : 'unexpected_schema',
            pending_alarms_count: pendingAlarmsCount,
          },
        },
        security: {
          secrets_exposed: false,
          pii_filtered: true,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    const elapsedMs = Math.round(performance.now() - startTime);
    console.error('[MCP Diagnostic] Unexpected internal error occurred');
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        latency_ms: elapsedMs,
        error_code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
