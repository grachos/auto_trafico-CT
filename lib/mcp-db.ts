import { getMySqlPool } from './db';
import { EncryptedData } from './mcp-crypto';

export interface McpAuditEntry {
  type: string;
  reference?: string;
  actor: string;
  username: string;
  connectionId?: string;
  result: 'SUCCESS' | 'ERROR' | 'REJECTED';
  errorCode?: string;
  durationMs: number;
}

/**
 * Ensures MCP tables exist in MySQL database idempotently.
 */
export async function ensureMcpTables(): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_credenciales (
        usuario VARCHAR(120) NOT NULL PRIMARY KEY,
        encrypted_password TEXT NOT NULL,
        iv VARCHAR(32) NOT NULL,
        auth_tag VARCHAR(32) NOT NULL,
        actualizado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        requiere_reauth TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_candados (
        usuario VARCHAR(120) NOT NULL PRIMARY KEY,
        locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        locked_by VARCHAR(64) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_auditoria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        referencia VARCHAR(100) NULL,
        actor VARCHAR(100) NOT NULL,
        usuario VARCHAR(120) NOT NULL,
        conexion_id VARCHAR(100) NULL,
        resultado VARCHAR(20) NOT NULL,
        error_code VARCHAR(50) NULL,
        duracion_ms INT DEFAULT 0,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_conexiones (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        usuario VARCHAR(120) NOT NULL,
        client_id VARCHAR(100) NOT NULL,
        scope VARCHAR(100) DEFAULT 'controlt:read controlt:write',
        client_label VARCHAR(100) NULL,
        revocada TINYINT(1) DEFAULT 0,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_usuario_revocada (usuario, revocada)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_tickets (
        ticket_hash VARCHAR(64) NOT NULL PRIMARY KEY,
        usuario VARCHAR(120) NOT NULL,
        expira_at TIMESTAMP NOT NULL,
        usado TINYINT(1) DEFAULT 0,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_invitaciones (
        token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
        usuario VARCHAR(120) NOT NULL,
        expira_at TIMESTAMP NOT NULL,
        intentos TINYINT DEFAULT 0,
        usado TINYINT(1) DEFAULT 0,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mcp_ip_rate_limits (
        ip VARCHAR(45) NOT NULL PRIMARY KEY,
        fallos INT DEFAULT 1,
        primer_fallo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        bloqueado_hasta TIMESTAMP NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.error('[MCP DB] Error ensuring MCP tables exist:', err.message);
  }
}

/**
 * Saves or updates encrypted user credentials.
 */
export async function saveMcpCredentials(username: string, data: EncryptedData): Promise<boolean> {
  const pool = getMySqlPool();
  if (!pool) return false;

  await ensureMcpTables();

  const cleanUser = username.trim().toLowerCase();
  const query = `
    INSERT INTO mcp_credenciales (usuario, encrypted_password, iv, auth_tag, requiere_reauth)
    VALUES (?, ?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE
      encrypted_password = VALUES(encrypted_password),
      iv = VALUES(iv),
      auth_tag = VALUES(auth_tag),
      requiere_reauth = 0,
      actualizado_at = CURRENT_TIMESTAMP
  `;

  try {
    await pool.execute(query, [cleanUser, data.encryptedPassword, data.iv, data.authTag]);
    return true;
  } catch (err: any) {
    console.error('[MCP DB] Error saving credentials for user');
    return false;
  }
}

/**
 * Retrieves encrypted credentials for a user.
 */
export async function getMcpCredentials(username: string): Promise<(EncryptedData & { requiereReauth: boolean }) | null> {
  const pool = getMySqlPool();
  if (!pool) return null;

  await ensureMcpTables();

  const cleanUser = username.trim().toLowerCase();
  const query = `
    SELECT encrypted_password, iv, auth_tag, requiere_reauth
    FROM mcp_credenciales
    WHERE usuario = ?
    LIMIT 1
  `;

  try {
    const [rows]: any = await pool.execute(query, [cleanUser]);
    if (!rows || rows.length === 0) return null;

    return {
      encryptedPassword: rows[0].encrypted_password,
      iv: rows[0].iv,
      authTag: rows[0].auth_tag,
      requiereReauth: Boolean(rows[0].requiere_reauth),
    };
  } catch (err: any) {
    console.error('[MCP DB] Error reading credentials for user');
    return null;
  }
}

/**
 * Marks that a user's credentials failed authentication in ControlT (e.g., password changed).
 * Ceases subsequent login attempts to avoid locking their corporate account.
 */
export async function markMcpUserRequiresReauth(username: string): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;

  const cleanUser = username.trim().toLowerCase();
  try {
    await pool.execute(
      `UPDATE mcp_credenciales SET requiere_reauth = 1 WHERE usuario = ?`,
      [cleanUser]
    );
  } catch (err: any) {
    console.error('[MCP DB] Error marking user requires reauth');
  }
}

/**
 * Acquires a distributed lock for a user session to prevent concurrent operations.
 * If occupied and not expired, returns { acquired: false, reason: 'USER_BUSY' }.
 */
export async function acquireDistributedLock(
  username: string,
  ownerId: string,
  ttlSeconds = 60
): Promise<{ acquired: boolean; reason?: 'USER_BUSY' | 'DB_ERROR' }> {
  const pool = getMySqlPool();
  if (!pool) return { acquired: false, reason: 'DB_ERROR' };

  await ensureMcpTables();
  const cleanUser = username.trim().toLowerCase();

  try {
    // Attempt 1: Try to insert lock row if it does not exist
    const insertQuery = `
      INSERT INTO mcp_candados (usuario, locked_at, locked_by)
      VALUES (?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        locked_by = IF(locked_at < NOW() - INTERVAL ? SECOND, VALUES(locked_by), locked_by),
        locked_at = IF(locked_at < NOW() - INTERVAL ? SECOND, NOW(), locked_at)
    `;

    await pool.execute(insertQuery, [cleanUser, ownerId, ttlSeconds, ttlSeconds]);

    // Verify if our ownerId currently holds the lock
    const [verifyRows]: any = await pool.execute(
      `SELECT locked_by FROM mcp_candados WHERE usuario = ?`,
      [cleanUser]
    );

    if (verifyRows && verifyRows[0]?.locked_by === ownerId) {
      return { acquired: true };
    }

    return { acquired: false, reason: 'USER_BUSY' };
  } catch (err: any) {
    console.error('[MCP DB] Distributed lock acquisition error:', err.message);
    return { acquired: false, reason: 'DB_ERROR' };
  }
}

/**
 * Releases the distributed lock for a user session.
 */
export async function releaseDistributedLock(username: string, ownerId: string): Promise<boolean> {
  const pool = getMySqlPool();
  if (!pool) return false;

  const cleanUser = username.trim().toLowerCase();
  try {
    await pool.execute(
      `DELETE FROM mcp_candados WHERE usuario = ? AND locked_by = ?`,
      [cleanUser, ownerId]
    );
    return true;
  } catch (err: any) {
    console.error('[MCP DB] Distributed lock release error:', err.message);
    return false;
  }
}

/**
 * Records an audit entry for write operations executed via MCP.
 */
export async function recordMcpAudit(entry: McpAuditEntry): Promise<void> {
  const pool = getMySqlPool();
  if (!pool) return;

  try {
    await pool.execute(
      `INSERT INTO mcp_auditoria 
        (tipo, referencia, actor, usuario, conexion_id, resultado, error_code, duracion_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.type,
        entry.reference || null,
        entry.actor,
        entry.username.trim().toLowerCase(),
        entry.connectionId || null,
        entry.result,
        entry.errorCode || null,
        entry.durationMs,
      ]
    );
  } catch (err: any) {
    console.error('[MCP DB] Audit record error:', err.message);
  }
}

