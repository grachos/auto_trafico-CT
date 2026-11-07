import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export function getMySqlPool(): Pool | null {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST || 'srv2184.hstgr.io';
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE || 'u279856486_control_T';

  if (!user || !password) {
    return null;
  }

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    console.log(`Pool MySQL inicializado hacia ${host}:${port}/${database}`);
    return pool;
  } catch (err: any) {
    console.error('Error inicializando pool MySQL:', err.message);
    return null;
  }
}

/**
 * Registra una atención del agente en la base de datos MySQL (u279856486_control_T)
 */
export async function registrarAuditoriaDB(params: {
  alarmaId: string;
  nroViaje: string;
  placa: string;
  novedad: string;
  comentario: string;
  canalOrigen: 'WEB_APP' | 'TELEGRAM' | 'MCP_AGENT' | 'PILOTO_AUTOMATICO';
  usuarioOrigen?: string;
  exitoso?: boolean;
}) {
  const p = getMySqlPool();
  if (!p) {
    return { recorded: false, reason: 'Variables de conexión MySQL no configuradas' };
  }

  try {
    const query = `
      INSERT INTO atenciones_auditoria 
      (alarma_id, nro_viaje, placa, novedad_aplicada, comentario, canal_origen, usuario_origen, exitoso)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      params.alarmaId,
      params.nroViaje,
      params.placa,
      params.novedad,
      params.comentario,
      params.canalOrigen,
      params.usuarioOrigen || 'Desconocido',
      params.exitoso ? 1 : 0,
    ];

    const [result] = await p.execute(query, values);
    return { recorded: true, result };
  } catch (err: any) {
    console.error('Error registrando auditoría en MySQL:', err.message);
    return { recorded: false, error: err.message };
  }
}

/**
 * Verifica la conexión con el servidor MySQL (Hostinger)
 */
export async function testMySqlConnection(): Promise<{ connected: boolean; message: string; version?: string }> {
  const p = getMySqlPool();
  if (!p) {
    return { connected: false, message: 'Faltan MYSQL_USER y MYSQL_PASSWORD en variables de entorno' };
  }

  try {
    const [rows]: any = await p.query('SELECT VERSION() as version');
    const version = rows?.[0]?.version || 'MySQL';
    return { connected: true, message: 'Conectado exitosamente al servidor MySQL', version };
  } catch (err: any) {
    return { connected: false, message: `Error de conexión MySQL: ${err.message}` };
  }
}

/**
 * Inicializa la tabla de sesiones de usuarios en MySQL si no existe
 */
export async function ensureAuthTableExists(): Promise<void> {
  const p = getMySqlPool();
  if (!p) return;
  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS usuarios_controlt_sesiones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_controlt VARCHAR(120) NOT NULL,
        canal VARCHAR(30) NOT NULL,
        identificador_canal VARCHAR(100) NOT NULL,
        nombre VARCHAR(120) NULL,
        token_controlt TEXT NULL,
        activo TINYINT(1) DEFAULT 1,
        fecha_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_canal_identificador (canal, identificador_canal)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.warn('Error verificando tabla de sesiones:', err.message);
  }
}

/**
 * Registra o actualiza la sesión de un usuario autenticado
 */
export async function registrarSesionUsuario(params: {
  usuario: string;
  canal: 'WEB' | 'TELEGRAM' | 'WHATSAPP' | 'MCP';
  identificador: string;
  token?: string;
  nombre?: string;
}): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  await ensureAuthTableExists();

  try {
    const query = `
      INSERT INTO usuarios_controlt_sesiones
      (usuario_controlt, canal, identificador_canal, nombre, token_controlt, activo, ultimo_acceso)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        usuario_controlt = VALUES(usuario_controlt),
        nombre = VALUES(nombre),
        token_controlt = VALUES(token_controlt),
        activo = 1,
        ultimo_acceso = CURRENT_TIMESTAMP
    `;
    await p.execute(query, [
      params.usuario,
      params.canal,
      params.identificador,
      params.nombre || params.usuario,
      params.token || null,
    ]);
    return true;
  } catch (err: any) {
    console.error('Error registrando sesión de usuario en MySQL:', err.message);
    return false;
  }
}

/**
 * Verifica si un usuario/canal tiene una sesión activa
 */
export async function verificarSesionUsuario(
  canal: 'WEB' | 'TELEGRAM' | 'WHATSAPP' | 'MCP',
  identificador: string
): Promise<{ autenticado: boolean; usuario?: string; nombre?: string; token?: string }> {
  const p = getMySqlPool();
  if (!p) return { autenticado: false };

  await ensureAuthTableExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT usuario_controlt, nombre, token_controlt 
       FROM usuarios_controlt_sesiones 
       WHERE canal = ? AND identificador_canal = ? AND activo = 1 
       LIMIT 1`,
      [canal, identificador]
    );

    if (rows && rows.length > 0) {
      const u = rows[0];
      return {
        autenticado: true,
        usuario: u.usuario_controlt,
        nombre: u.nombre || u.usuario_controlt,
        token: u.token_controlt,
      };
    }
    return { autenticado: false };
  } catch (err: any) {
    console.warn('Error verificando sesión en MySQL:', err.message);
    return { autenticado: false };
  }
}

/**
 * Cierra la sesión activa de un usuario en un canal
 */
export async function cerrarSesionUsuario(
  canal: 'WEB' | 'TELEGRAM' | 'WHATSAPP' | 'MCP',
  identificador: string
): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  try {
    await p.execute(
      `UPDATE usuarios_controlt_sesiones SET activo = 0 WHERE canal = ? AND identificador_canal = ?`,
      [canal, identificador]
    );
    return true;
  } catch (err: any) {
    console.error('Error cerrando sesión en MySQL:', err.message);
    return false;
  }
}
