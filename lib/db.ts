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
