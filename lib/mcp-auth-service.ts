import crypto from 'crypto';
import { getMySqlPool } from './db';
import { ensureMcpTables } from './mcp-db';
import { hashTicket, generateFormattedTicket } from './mcp-crypto';

export interface ActiveConnection {
  id: string;
  usuario: string;
  clientId: string;
  clientLabel: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string;
}

/**
 * Checks if the caller IP is temporarily rate-limited due to brute-force attempts.
 */
export async function checkIpRateLimit(ip: string): Promise<{ blocked: boolean; remainingSeconds?: number }> {
  const pool = getMySqlPool();
  if (!pool) return { blocked: false };

  await ensureMcpTables();
  const cleanIp = (ip || 'unknown').trim().substring(0, 45);

  try {
    const query = `
      SELECT fallos, bloqueado_hasta,
             TIMESTAMPDIFF(SECOND, NOW(), bloqueado_hasta) AS remaining_sec
      FROM mcp_ip_rate_limits
      WHERE ip = ?
      LIMIT 1
    `;
    const [rows]: any = await pool.execute(query, [cleanIp]);
    if (!rows || rows.length === 0) return { blocked: false };

    const row = rows[0];
    if (row.bloqueado_hasta && row.remaining_sec > 0) {
      return { blocked: true, remainingSeconds: Number(row.remaining_sec) };
    }

    return { blocked: false };
  } catch (err: any) {
    console.error('[MCP Auth] Error checking IP rate limit:', err.message);
    return { blocked: false };
  }
}

/**
 * Records an authentication failure for an IP.
 * After 10 failures in a 15-minute window, blocks the IP for 15 minutes.
 */
export async function recordIpFailure(ip: string): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;

  await ensureMcpTables();
  const cleanIp = (ip || 'unknown').trim().substring(0, 45);

  try {
    const query = `
      INSERT INTO mcp_ip_rate_limits (ip, fallos, primer_fallo, bloqueado_hasta)
      VALUES (?, 1, NOW(), NULL)
      ON DUPLICATE KEY UPDATE
        fallos = IF(primer_fallo < NOW() - INTERVAL 15 MINUTE, 1, fallos + 1),
        primer_fallo = IF(primer_fallo < NOW() - INTERVAL 15 MINUTE, NOW(), primer_fallo),
        bloqueado_hasta = IF(fallos >= 10, NOW() + INTERVAL 15 MINUTE, bloqueado_hasta)
    `;
    await pool.execute(query, [cleanIp]);
  } catch (err: any) {
    console.error('[MCP Auth] Error recording IP failure:', err.message);
  }
}

/**
 * Clears failed attempts for an IP after a successful authentication.
 */
export async function resetIpFailures(ip: string): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;

  const cleanIp = (ip || 'unknown').trim().substring(0, 45);
  try {
    await pool.execute(`DELETE FROM mcp_ip_rate_limits WHERE ip = ?`, [cleanIp]);
  } catch (err: any) {
    console.error('[MCP Auth] Error resetting IP failures:', err.message);
  }
}

/**
 * Generates a one-time access ticket for the user.
 * Max 5 tickets per user per hour. 15-minute expiration window.
 * Only the HMAC-SHA256 hash is persisted in the database.
 */
export async function createAccessTicket(
  username: string
): Promise<{ ticket: string; expiresAt: string } | { error: string; message: string }> {
  const pool = getMySqlPool();
  if (!pool) {
    return { error: 'DB_UNAVAILABLE', message: 'Database connection is not available' };
  }

  await ensureMcpTables();
  const cleanUser = username.trim().toLowerCase();

  // Enforce ticket generation rate limit: max 5 per hour
  try {
    const [rateRows]: any = await pool.execute(
      `SELECT COUNT(*) as ticket_count 
       FROM mcp_tickets 
       WHERE usuario = ? AND creado_at > NOW() - INTERVAL 1 HOUR`,
      [cleanUser]
    );

    const ticketCount = Number(rateRows?.[0]?.ticket_count || 0);
    if (ticketCount >= 5) {
      return {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Maximum limit of 5 access tickets per hour exceeded. Please try again later.',
      };
    }

    const formattedTicket = generateFormattedTicket();
    const ticketHash = hashTicket(formattedTicket);

    const query = `
      INSERT INTO mcp_tickets (ticket_hash, usuario, expira_at, usado)
      VALUES (?, ?, NOW() + INTERVAL 15 MINUTE, 0)
    `;
    await pool.execute(query, [ticketHash, cleanUser]);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return { ticket: formattedTicket, expiresAt };
  } catch (err: any) {
    console.error('[MCP Auth] Error creating access ticket:', err.message);
    return { error: 'INTERNAL_ERROR', message: 'Could not generate access ticket' };
  }
}

/**
 * Redeems an access ticket and registers a revocable connection for the client.
 * Ticket is marked as used atomically.
 */
export async function redeemAccessTicket(params: {
  ticket: string;
  clientId: string;
  clientLabel?: string;
  scope?: string;
  ip?: string;
}): Promise<{
  success: boolean;
  connectionId?: string;
  username?: string;
  error?: string;
}> {
  const pool = getMySqlPool();
  if (!pool) return { success: false, error: 'DB_UNAVAILABLE' };

  await ensureMcpTables();
  const clientIp = params.ip || 'unknown';

  // 1. IP rate-limit check
  const ipStatus = await checkIpRateLimit(clientIp);
  if (ipStatus.blocked) {
    return { success: false, error: 'IP_BLOCKED' };
  }

  let ticketHash = '';
  try {
    ticketHash = hashTicket(params.ticket);
  } catch {
    await recordIpFailure(clientIp);
    return { success: false, error: 'INVALID_TICKET' };
  }

  try {
    // 2. Look up valid, unexpired, unused ticket
    const [ticketRows]: any = await pool.execute(
      `SELECT usuario, expira_at, usado 
       FROM mcp_tickets 
       WHERE ticket_hash = ? AND expira_at > NOW() AND usado = 0 
       LIMIT 1`,
      [ticketHash]
    );

    if (!ticketRows || ticketRows.length === 0) {
      await recordIpFailure(clientIp);
      return { success: false, error: 'INVALID_TICKET' };
    }

    const user = String(ticketRows[0].usuario).trim().toLowerCase();

    // 3. Atomically mark ticket as used
    const [updateResult]: any = await pool.execute(
      `UPDATE mcp_tickets SET usado = 1 WHERE ticket_hash = ? AND usado = 0`,
      [ticketHash]
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      await recordIpFailure(clientIp);
      return { success: false, error: 'INVALID_TICKET' };
    }

    // Ticket redeemed successfully: reset failure counter for IP
    await resetIpFailures(clientIp);

    // 4. Enforce maximum 3 active connections per user. Revoke oldest if needed.
    const [activeConns]: any = await pool.execute(
      `SELECT id FROM mcp_conexiones WHERE usuario = ? AND revocada = 0 ORDER BY creado_at ASC`,
      [user]
    );

    if (Array.isArray(activeConns) && activeConns.length >= 3) {
      const connectionsToRevoke = activeConns.slice(0, activeConns.length - 2);
      for (const oldConn of connectionsToRevoke) {
        await pool.execute(`UPDATE mcp_conexiones SET revocada = 1 WHERE id = ?`, [oldConn.id]);
      }
    }

    // 5. Create new revocable connection
    const connectionId = 'conn_' + crypto.randomUUID();
    const scope = params.scope || 'controlt:read controlt:write';
    const clientLabel = params.clientLabel || 'AI Assistant Connector';

    await pool.execute(
      `INSERT INTO mcp_conexiones 
        (id, usuario, client_id, scope, client_label, revocada, creado_at, ultimo_uso)
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [connectionId, user, params.clientId, scope, clientLabel]
    );

    return {
      success: true,
      connectionId,
      username: user,
    };
  } catch (err: any) {
    console.error('[MCP Auth] Error redeeming ticket:', err.message);
    await recordIpFailure(clientIp);
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}

/**
 * Validates a connection on each incoming MCP tool call.
 * Checks that connection exists, is not revoked, and has been active within 90 days.
 */
export async function validateConnection(
  connectionId: string,
  requiredScope?: string
): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  const pool = getMySqlPool();
  if (!pool) return { valid: false, error: 'DB_UNAVAILABLE' };

  try {
    const query = `
      SELECT id, usuario, client_id, scope, revocada,
             TIMESTAMPDIFF(DAY, ultimo_uso, NOW()) AS inactive_days
      FROM mcp_conexiones
      WHERE id = ?
      LIMIT 1
    `;
    const [rows]: any = await pool.execute(query, [connectionId]);
    if (!rows || rows.length === 0) {
      return { valid: false, error: 'CONNECTION_NOT_FOUND' };
    }

    const conn = rows[0];

    // Check revocation
    if (Boolean(conn.revocada)) {
      return { valid: false, error: 'CONNECTION_REVOKED' };
    }

    // Check 90-day inactivity limit
    if (Number(conn.inactive_days || 0) > 90) {
      await pool.execute(`UPDATE mcp_conexiones SET revocada = 1 WHERE id = ?`, [connectionId]);
      return { valid: false, error: 'CONNECTION_EXPIRED' };
    }

    // Check scope if required
    if (requiredScope && !String(conn.scope || '').includes(requiredScope)) {
      return { valid: false, error: 'INSUFFICIENT_SCOPE' };
    }

    // Update last used timestamp
    await pool.execute(
      `UPDATE mcp_conexiones SET ultimo_uso = CURRENT_TIMESTAMP WHERE id = ?`,
      [connectionId]
    );

    return {
      valid: true,
      username: String(conn.usuario).trim().toLowerCase(),
    };
  } catch (err: any) {
    console.error('[MCP Auth] Error validating connection:', err.message);
    return { valid: false, error: 'INTERNAL_ERROR' };
  }
}

/**
 * Immediately revokes an active connection.
 */
export async function revokeConnection(connectionId: string, username?: string): Promise<boolean> {
  const pool = getMySqlPool();
  if (!pool) return false;

  try {
    if (username) {
      const cleanUser = username.trim().toLowerCase();
      const [res]: any = await pool.execute(
        `UPDATE mcp_conexiones SET revocada = 1 WHERE id = ? AND usuario = ?`,
        [connectionId, cleanUser]
      );
      return res.affectedRows > 0;
    } else {
      const [res]: any = await pool.execute(
        `UPDATE mcp_conexiones SET revocada = 1 WHERE id = ?`,
        [connectionId]
      );
      return res.affectedRows > 0;
    }
  } catch (err: any) {
    console.error('[MCP Auth] Error revoking connection:', err.message);
    return false;
  }
}

/**
 * Lists all active (non-revoked) connections for a user, or all active connections if username is omitted (for admins).
 */
export async function listActiveConnections(username?: string): Promise<ActiveConnection[]> {
  const pool = getMySqlPool();
  if (!pool) return [];

  await ensureMcpTables();
  const cleanUser = username ? username.trim().toLowerCase() : null;

  try {
    let query: string;
    let params: any[] = [];

    if (cleanUser) {
      query = `
        SELECT id, usuario, client_id, client_label, scope, creado_at, ultimo_uso
        FROM mcp_conexiones
        WHERE usuario = ? AND revocada = 0
        ORDER BY ultimo_uso DESC
      `;
      params = [cleanUser];
    } else {
      query = `
        SELECT id, usuario, client_id, client_label, scope, creado_at, ultimo_uso
        FROM mcp_conexiones
        WHERE revocada = 0
        ORDER BY ultimo_uso DESC
      `;
    }

    const [rows]: any = await pool.execute(query, params);
    if (!rows || !Array.isArray(rows)) return [];

    return rows.map((r: any) => ({
      id: r.id,
      usuario: String(r.usuario || ''),
      clientId: r.client_id,
      clientLabel: r.client_label || 'AI Assistant Connector',
      scope: r.scope || 'controlt:read controlt:write',
      createdAt: new Date(r.creado_at).toISOString(),
      lastUsedAt: new Date(r.ultimo_uso).toISOString(),
    }));
  } catch (err: any) {
    console.error('[MCP Auth] Error listing active connections:', err.message);
    return [];
  }
}

