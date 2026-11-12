import crypto from 'crypto';
import { getMcpHmacSecret } from './mcp-crypto';
import { getMySqlPool } from './db';
import { ensureMcpTables } from './mcp-db';

export interface AuthCodePayload {
  conn: string;
  user: string;
  client: string;
  challenge: string;
  redirect_uri: string;
  exp: number; // Unix timestamp in seconds
}

export interface AccessTokenPayload {
  sub: string;       // username
  conn: string;      // connectionId
  client_id: string; // client_id
  scope: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  conn: string;
  client_id: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
}

/**
 * Ensures table for dynamic client registration exists.
 */
export async function ensureOAuthClientsTable(): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;
  await ensureMcpTables();

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
        client_id VARCHAR(100) NOT NULL PRIMARY KEY,
        client_secret VARCHAR(120) NULL,
        client_name VARCHAR(150) NOT NULL,
        redirect_uris TEXT NOT NULL,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.error('[MCP OAuth] Error ensuring oauth clients table:', err.message);
  }
}

/**
 * Validates PKCE S256 code_verifier against code_challenge.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  try {
    const computedChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    const bufComputed = Buffer.from(computedChallenge, 'utf8');
    const bufExpected = Buffer.from(codeChallenge, 'utf8');
    if (bufComputed.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufComputed, bufExpected);
  } catch {
    return false;
  }
}

/**
 * Base64url helper encode/decode with signature.
 */
function signPayload(payload: object): string {
  const secret = getMcpHmacSecret();
  const serialized = JSON.stringify(payload);
  const dataB64 = Buffer.from(serialized, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

function verifyAndDecodePayload<T>(token: string): T | null {
  if (!token || !token.includes('.')) return null;
  const secret = getMcpHmacSecret();
  const [dataB64, signature] = token.split('.');

  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    const bufActual = Buffer.from(signature, 'utf8');
    const bufExpected = Buffer.from(expectedSig, 'utf8');
    if (bufActual.length !== bufExpected.length || !crypto.timingSafeEqual(bufActual, bufExpected)) {
      return null;
    }

    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

/**
 * Creates an HMAC-signed Authorization Code valid for 5 minutes.
 */
export function createSignedAuthCode(data: {
  connectionId: string;
  username: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const exp = Math.floor(Date.now() / 1000) + 300; // 5 minutes TTL
  const payload: AuthCodePayload = {
    conn: data.connectionId,
    user: data.username,
    client: data.clientId,
    challenge: data.codeChallenge,
    redirect_uri: data.redirectUri,
    exp,
  };
  return signPayload(payload);
}

/**
 * Verifies and decodes an Authorization Code.
 */
export function verifySignedAuthCode(code: string): { valid: boolean; payload?: AuthCodePayload; error?: string } {
  const payload = verifyAndDecodePayload<AuthCodePayload>(code);
  if (!payload) {
    return { valid: false, error: 'INVALID_CODE_SIGNATURE' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    return { valid: false, error: 'CODE_EXPIRED' };
  }

  return { valid: true, payload };
}

/**
 * Issues an HMAC-signed Access Token valid for 1 hour.
 */
export function createSignedAccessToken(data: {
  connectionId: string;
  username: string;
  clientId: string;
  scope?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: data.username,
    conn: data.connectionId,
    client_id: data.clientId,
    scope: data.scope || 'controlt:read controlt:write',
    iat: now,
    exp: now + 3600, // 1 hour TTL
  };
  return signPayload(payload);
}

/**
 * Verifies an Access Token.
 */
export function verifySignedAccessToken(token: string): { valid: boolean; payload?: AccessTokenPayload; error?: string } {
  const payload = verifyAndDecodePayload<AccessTokenPayload>(token);
  if (!payload || !payload.conn || !payload.sub) {
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  return { valid: true, payload };
}

/**
 * Issues an HMAC-signed Refresh Token valid for 30 days.
 */
export function createSignedRefreshToken(data: {
  connectionId: string;
  username: string;
  clientId: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: RefreshTokenPayload = {
    sub: data.username,
    conn: data.connectionId,
    client_id: data.clientId,
    type: 'refresh',
    iat: now,
    exp: now + 30 * 86400, // 30 days TTL
  };
  return signPayload(payload);
}

/**
 * Verifies a Refresh Token.
 */
export function verifySignedRefreshToken(token: string): { valid: boolean; payload?: RefreshTokenPayload; error?: string } {
  const payload = verifyAndDecodePayload<RefreshTokenPayload>(token);
  if (!payload || payload.type !== 'refresh' || !payload.conn) {
    return { valid: false, error: 'INVALID_REFRESH_TOKEN' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    return { valid: false, error: 'REFRESH_TOKEN_EXPIRED' };
  }

  return { valid: true, payload };
}

/**
 * Dynamically registers an OAuth client (RFC 7591).
 */
export async function registerOAuthClient(params: {
  clientName?: string;
  redirectUris: string[];
}): Promise<OAuthClient> {
  await ensureOAuthClientsTable();
  const pool = getMySqlPool();

  const clientId = 'mcp_client_' + crypto.randomBytes(12).toString('hex');
  const clientSecret = 'mcp_secret_' + crypto.randomBytes(24).toString('hex');
  const clientName = params.clientName?.trim() || 'AI Assistant Client';
  const redirectUrisJson = JSON.stringify(params.redirectUris || []);

  if (pool) {
    try {
      await pool.execute(
        `INSERT INTO mcp_oauth_clients (client_id, client_secret, client_name, redirect_uris)
         VALUES (?, ?, ?, ?)`,
        [clientId, clientSecret, clientName, redirectUrisJson]
      );
    } catch (err: any) {
      console.error('[MCP OAuth] Error persisting client in DB:', err.message);
    }
  }

  return {
    clientId,
    clientSecret,
    clientName,
    redirectUris: params.redirectUris,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Retrieves client metadata and verifies if redirect_uri is authorized.
 */
export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  // Built-in standard clients (Claude & ChatGPT) are pre-whitelisted
  if (clientId === 'claude' || clientId === 'claude-desktop' || clientId === 'claude-web') {
    return {
      clientId,
      clientName: 'Claude AI Assistant',
      redirectUris: [
        'https://claude.ai/api/mcp/oauth/callback',
        'http://localhost:3000/callback',
        'http://localhost:8080/callback',
        'https://desktop.claude.ai/callback',
      ],
      createdAt: new Date().toISOString(),
    };
  }

  if (clientId === 'chatgpt' || clientId === 'openai') {
    return {
      clientId,
      clientName: 'ChatGPT Connector',
      redirectUris: [
        'https://chatgpt.com/api/mcp/oauth/callback',
        'https://chat.openai.com/aip/callback',
      ],
      createdAt: new Date().toISOString(),
    };
  }

  await ensureOAuthClientsTable();
  const pool = getMySqlPool();
  if (!pool) return null;

  try {
    const [rows]: any = await pool.execute(
      `SELECT client_id, client_secret, client_name, redirect_uris, creado_at
       FROM mcp_oauth_clients
       WHERE client_id = ?
       LIMIT 1`,
      [clientId]
    );

    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    let uris: string[] = [];
    try {
      uris = JSON.parse(r.redirect_uris);
    } catch {
      uris = [r.redirect_uris];
    }

    return {
      clientId: r.client_id,
      clientSecret: r.client_secret,
      clientName: r.client_name,
      redirectUris: uris,
      createdAt: new Date(r.creado_at).toISOString(),
    };
  } catch (err: any) {
    console.error('[MCP OAuth] Error fetching client:', err.message);
    return null;
  }
}

