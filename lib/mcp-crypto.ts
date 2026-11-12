import crypto from 'crypto';

/**
 * Validates and retrieves the 32-byte AES-256 master key from environment variables.
 * Key must be 64 hexadecimal characters.
 */
export function getMcpEncryptionKey(): Buffer {
  const hexKey = (process.env.MCP_ENCRYPTION_KEY || '').replace(/^["']|["']$/g, '').trim();

  if (!hexKey) {
    throw new Error('MCP_ENCRYPTION_KEY is not defined in environment variables');
  }

  if (hexKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('MCP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)');
  }

  return Buffer.from(hexKey, 'hex');
}

export interface EncryptedData {
  encryptedPassword: string; // hex
  iv: string;                // hex (12 bytes)
  authTag: string;           // hex (16 bytes)
}

/**
 * Encrypts a password using AES-256-GCM.
 * The username is passed as Additional Authenticated Data (AAD) to prevent ciphertext transplant attacks.
 */
export function encryptPassword(plainPassword: string, username: string): EncryptedData {
  if (!plainPassword) {
    throw new Error('Password cannot be empty');
  }

  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser) {
    throw new Error('Username required for AAD binding');
  }

  const masterKey = getMcpEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  cipher.setAAD(Buffer.from(cleanUser, 'utf8'));

  const encrypted = Buffer.concat([
    cipher.update(plainPassword, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedPassword: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts a password using AES-256-GCM.
 * Verifies the authTag and the username as AAD.
 * Returns the decrypted plaintext password in memory only.
 */
export function decryptPassword(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string,
  username: string
): string {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser) {
    throw new Error('Username required for AAD binding');
  }

  const masterKey = getMcpEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAAD(Buffer.from(cleanUser, 'utf8'));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Retrieves the HMAC secret used for signing OAuth tokens and hashing tickets.
 */
export function getMcpHmacSecret(): string {
  const secret = (process.env.MCP_HMAC_SECRET || '').replace(/^["']|["']$/g, '').trim();
  if (!secret) {
    throw new Error('MCP_HMAC_SECRET is not configured in environment variables');
  }
  return secret;
}

/**
 * Normalizes an access ticket string by stripping hyphens/whitespace and uppercasing.
 */
export function normalizeTicket(ticket: string): string {
  return (ticket || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Computes the HMAC-SHA256 hash of a normalized access ticket.
 * Tickets are never stored in plaintext in the database.
 */
export function hashTicket(ticket: string): string {
  const normalized = normalizeTicket(ticket);
  if (!normalized) {
    throw new Error('Ticket cannot be empty');
  }
  const secret = getMcpHmacSecret();
  return crypto.createHmac('sha256', secret).update('ticket:' + normalized).digest('hex');
}

/**
 * Generates a human-friendly, cryptographically secure 16-character access ticket.
 * Uses an unambiguous 32-character alphabet (omits 0/O, 1/I) formatted as XXXX-XXXX-XXXX-XXXX.
 */
export function generateFormattedTicket(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let raw = '';
  for (let i = 0; i < 16; i++) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}


