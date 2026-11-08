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
      connectTimeout: 3000,
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
 * Inicializa la tabla de sesiones y registro de usuarios en MySQL si no existen
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

    await p.execute(`
      CREATE TABLE IF NOT EXISTS usuarios_controlt_registro (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_controlt VARCHAR(120) NOT NULL UNIQUE,
        nombre VARCHAR(150) NULL,
        estado VARCHAR(20) DEFAULT 'ACTIVO',
        rol VARCHAR(20) DEFAULT 'OPERADOR',
        primer_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        ultimo_canal VARCHAR(30) DEFAULT 'WEB'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Asegurar que el usuario administrador principal esté registrado y activo
    await p.execute(`
      INSERT INTO usuarios_controlt_registro (usuario_controlt, nombre, estado, rol, ultimo_canal)
      VALUES ('ggomez@elogia.com.co', 'Graziany Gomez (Admin)', 'ACTIVO', 'ADMIN', 'WEB')
      ON DUPLICATE KEY UPDATE estado = 'ACTIVO', rol = 'ADMIN';
    `);
  } catch (err: any) {
    console.warn('Error verificando tabla de sesiones y usuarios:', err.message);
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
    const rawId = params.identificador || '';
    // Si el identificador supera 100 caracteres (ej: token JWT de ControlT), usar los primeros 100 caracteres
    // para cumplir con la columna VARCHAR(100) y almacenar el token completo en token_controlt (TEXT)
    const safeId = rawId.length > 100 ? rawId.substring(0, 100) : rawId;
    const finalToken = params.token || rawId;

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
      safeId,
      params.nombre || params.usuario,
      finalToken || null,
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
    const rawId = identificador || '';
    const prefix100 = rawId.length >= 100 ? rawId.substring(0, 100) : rawId;

    const [rows]: any = await p.execute(
      `SELECT usuario_controlt, nombre, token_controlt 
       FROM usuarios_controlt_sesiones 
       WHERE canal = ? 
         AND (
           identificador_canal = ? 
           OR identificador_canal = ?
           OR token_controlt = ? 
         ) 
         AND activo = 1 
       ORDER BY id DESC
       LIMIT 1`,
      [canal, rawId, prefix100, rawId]
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
  canal: 'WEB' | 'TELEGRAM' | 'WHATSAPP' | 'MCP' | 'OAUTH_CODE',
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

/**
 * Guarda un código temporal de autorización OAuth 2.0 (expira tras canje)
 */
export async function guardarCodigoOAuth(
  code: string,
  data: { usuario: string; nombre: string; token: string }
): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;
  await ensureAuthTableExists();

  try {
    await p.execute(
      `INSERT INTO usuarios_controlt_sesiones 
       (usuario_controlt, canal, identificador_canal, nombre, token_controlt, activo, ultimo_acceso)
       VALUES (?, 'OAUTH_CODE', ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE token_controlt = VALUES(token_controlt), activo = 1, ultimo_acceso = CURRENT_TIMESTAMP`,
      [data.usuario, code, data.nombre, data.token]
    );
    return true;
  } catch (err: any) {
    console.error('Error guardando código OAuth en MySQL:', err.message);
    return false;
  }
}

/**
 * Canjea un código de autorización OAuth por los datos del usuario y lo invalida
 */
export async function canjearCodigoOAuth(
  code: string
): Promise<{ valido: boolean; usuario?: string; nombre?: string; token?: string }> {
  const p = getMySqlPool();
  if (!p) return { valido: false };

  try {
    const [rows]: any = await p.execute(
      `SELECT usuario_controlt, nombre, token_controlt 
       FROM usuarios_controlt_sesiones 
       WHERE canal = 'OAUTH_CODE' AND identificador_canal = ? AND activo = 1 
       LIMIT 1`,
      [code]
    );

    if (rows && rows.length > 0) {
      await p.execute(
        `UPDATE usuarios_controlt_sesiones SET activo = 0 WHERE canal = 'OAUTH_CODE' AND identificador_canal = ?`,
        [code]
      );
      return {
        valido: true,
        usuario: rows[0].usuario_controlt,
        nombre: rows[0].nombre,
        token: rows[0].token_controlt,
      };
    }
    return { valido: false };
  } catch (err: any) {
    console.error('Error canjeando código OAuth en MySQL:', err.message);
    return { valido: false };
  }
}

/**
 * Verifica o registra por primera vez un usuario en el registro global de operadores.
 * Retorna su estado actual ('ACTIVO' | 'INACTIVO') y su rol ('ADMIN' | 'OPERADOR').
 */
export async function verificarORegistrarUsuarioGlobal(params: {
  usuario: string;
  nombre?: string;
  canal: string;
}): Promise<{ estado: 'ACTIVO' | 'INACTIVO'; rol: 'ADMIN' | 'OPERADOR' }> {
  const p = getMySqlPool();
  const uClean = params.usuario.toLowerCase().trim();
  const esAdmin = uClean === 'ggomez@elogia.com.co' || uClean === process.env.CONTROLT_USERNAME?.toLowerCase().trim();

  if (!p) {
    return { estado: 'ACTIVO', rol: esAdmin ? 'ADMIN' : 'OPERADOR' };
  }

  await ensureAuthTableExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT estado, rol FROM usuarios_controlt_registro WHERE LOWER(usuario_controlt) = ? LIMIT 1`,
      [uClean]
    );

    if (rows && rows.length > 0) {
      let estado = rows[0].estado || 'ACTIVO';
      let rol = rows[0].rol || (esAdmin ? 'ADMIN' : 'OPERADOR');

      if (esAdmin) {
        estado = 'ACTIVO';
        rol = 'ADMIN';
      }

      await p.execute(
        `UPDATE usuarios_controlt_registro 
         SET ultimo_login = CURRENT_TIMESTAMP, ultimo_canal = ?, nombre = COALESCE(?, nombre), estado = ?, rol = ? 
         WHERE LOWER(usuario_controlt) = ?`,
        [params.canal, params.nombre || null, estado, rol, uClean]
      );

      return { estado: estado as 'ACTIVO' | 'INACTIVO', rol: rol as 'ADMIN' | 'OPERADOR' };
    } else {
      const initialEstado = 'ACTIVO';
      const initialRol = esAdmin ? 'ADMIN' : 'OPERADOR';

      await p.execute(
        `INSERT INTO usuarios_controlt_registro 
         (usuario_controlt, nombre, estado, rol, ultimo_canal) 
         VALUES (?, ?, ?, ?, ?)`,
        [uClean, params.nombre || uClean, initialEstado, initialRol, params.canal]
      );

      return { estado: initialEstado, rol: initialRol };
    }
  } catch (err: any) {
    console.error('Error en verificarORegistrarUsuarioGlobal:', err.message);
    return { estado: 'ACTIVO', rol: esAdmin ? 'ADMIN' : 'OPERADOR' };
  }
}

/**
 * Consulta el estado actual de un usuario sin modificar su último login
 */
export async function verificarEstadoUsuario(
  usuario: string
): Promise<{ estado: 'ACTIVO' | 'INACTIVO'; rol: 'ADMIN' | 'OPERADOR'; existe: boolean }> {
  const p = getMySqlPool();
  const uClean = usuario.toLowerCase().trim();
  const esAdmin = uClean === 'ggomez@elogia.com.co' || uClean === process.env.CONTROLT_USERNAME?.toLowerCase().trim();

  if (!p) {
    return { estado: 'ACTIVO', rol: esAdmin ? 'ADMIN' : 'OPERADOR', existe: true };
  }

  await ensureAuthTableExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT estado, rol FROM usuarios_controlt_registro WHERE LOWER(usuario_controlt) = ? LIMIT 1`,
      [uClean]
    );

    if (rows && rows.length > 0) {
      const estado = esAdmin ? 'ACTIVO' : (rows[0].estado || 'ACTIVO');
      const rol = esAdmin ? 'ADMIN' : (rows[0].rol || 'OPERADOR');
      return { estado: estado as 'ACTIVO' | 'INACTIVO', rol: rol as 'ADMIN' | 'OPERADOR', existe: true };
    }

    return { estado: 'ACTIVO', rol: esAdmin ? 'ADMIN' : 'OPERADOR', existe: false };
  } catch (err: any) {
    console.error('Error verificando estado de usuario:', err.message);
    return { estado: 'ACTIVO', rol: esAdmin ? 'ADMIN' : 'OPERADOR', existe: true };
  }
}

/**
 * Lista todos los usuarios que han iniciado sesión al menos una vez para el panel de administración
 */
export async function listarUsuariosParaAdmin(adminUser: string): Promise<any[]> {
  const p = getMySqlPool();
  const uClean = adminUser.toLowerCase().trim();
  const esAdmin = uClean === 'ggomez@elogia.com.co' || uClean === process.env.CONTROLT_USERNAME?.toLowerCase().trim();

  if (!esAdmin) {
    throw new Error('Acceso no autorizado: Solo el administrador principal puede consultar la lista de usuarios.');
  }

  if (!p) return [];
  await ensureAuthTableExists();

  try {
    const [rows]: any = await p.execute(`
      SELECT 
        r.id,
        r.usuario_controlt as usuario,
        r.nombre,
        r.estado,
        r.rol,
        DATE_FORMAT(r.primer_login, '%Y-%m-%d %H:%i') as primerLogin,
        DATE_FORMAT(r.ultimo_login, '%Y-%m-%d %H:%i') as ultimoLogin,
        r.ultimo_canal as ultimoCanal,
        COALESCE((
          SELECT GROUP_CONCAT(DISTINCT s.canal SEPARATOR ', ')
          FROM usuarios_controlt_sesiones s
          WHERE LOWER(s.usuario_controlt) = LOWER(r.usuario_controlt)
        ), r.ultimo_canal) as canalesUsados
      FROM usuarios_controlt_registro r
      ORDER BY (CASE WHEN LOWER(r.usuario_controlt) = 'ggomez@elogia.com.co' THEN 0 ELSE 1 END), r.ultimo_login DESC
    `);

    return rows || [];
  } catch (err: any) {
    console.error('Error listando usuarios para admin:', err.message);
    return [];
  }
}

/**
 * Comprueba si un usuario tiene rol de Administrador en el sistema
 */
export async function esUsuarioAdmin(usuario: string): Promise<boolean> {
  const u = usuario?.toLowerCase().trim();
  if (!u) return false;
  
  // El usuario principal o la variable de entorno siempre son administradores
  const masterAdmin = (process.env.CONTROLT_USERNAME || 'ggomez@elogia.com.co').toLowerCase().trim();
  if (u === 'ggomez@elogia.com.co' || u === masterAdmin) {
    return true;
  }

  const p = getMySqlPool();
  if (!p) return false;

  await ensureAuthTableExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT rol, estado FROM usuarios_controlt_registro WHERE LOWER(usuario_controlt) = ? LIMIT 1`,
      [u]
    );

    if (rows && rows.length > 0) {
      return rows[0].rol === 'ADMIN' && rows[0].estado === 'ACTIVO';
    }
  } catch (err: any) {
    console.error('Error verificando rol admin de usuario:', err.message);
  }

  return false;
}

/**
 * Activa o desactiva un usuario del sistema (ejecutable por administradores)
 */
export async function actualizarEstadoUsuarioPorAdmin(
  adminUser: string,
  targetUser: string,
  nuevoEstado: 'ACTIVO' | 'INACTIVO'
): Promise<{ success: boolean; message: string }> {
  const p = getMySqlPool();
  const uAdmin = adminUser.toLowerCase().trim();
  const uTarget = targetUser.toLowerCase().trim();
  const esAdmin = await esUsuarioAdmin(uAdmin);

  if (!esAdmin) {
    throw new Error('Acceso no autorizado: Solo un administrador puede modificar el estado de los usuarios.');
  }

  if (uTarget === 'ggomez@elogia.com.co') {
    throw new Error('Operación no permitida: El administrador principal no puede ser desactivado.');
  }

  if (!p) {
    throw new Error('Base de datos no disponible.');
  }

  await ensureAuthTableExists();

  try {
    await p.execute(
      `UPDATE usuarios_controlt_registro SET estado = ? WHERE LOWER(usuario_controlt) = ?`,
      [nuevoEstado, uTarget]
    );

    // Si se inactiva, cerramos todas sus sesiones en curso
    if (nuevoEstado === 'INACTIVO') {
      await p.execute(
        `UPDATE usuarios_controlt_sesiones SET activo = 0 WHERE LOWER(usuario_controlt) = ?`,
        [uTarget]
      );
    }

    return {
      success: true,
      message: `Usuario ${uTarget} cambiado a estado ${nuevoEstado} con éxito.`,
    };
  } catch (err: any) {
    console.error('Error actualizando estado de usuario:', err.message);
    throw err;
  }
}

/**
 * Asigna el rol de Administrador u Operador a un usuario (ejecutable por administradores)
 */
export async function actualizarRolUsuarioPorAdmin(
  adminUser: string,
  targetUser: string,
  nuevoRol: 'ADMIN' | 'OPERADOR'
): Promise<{ success: boolean; message: string }> {
  const p = getMySqlPool();
  const uAdmin = adminUser.toLowerCase().trim();
  const uTarget = targetUser.toLowerCase().trim();
  const esAdmin = await esUsuarioAdmin(uAdmin);

  if (!esAdmin) {
    throw new Error('Acceso no autorizado: Solo un administrador puede asignar roles a usuarios.');
  }

  if (uTarget === 'ggomez@elogia.com.co' && nuevoRol !== 'ADMIN') {
    throw new Error('Operación no permitida: El administrador principal siempre debe mantener el rol ADMIN.');
  }

  if (!p) {
    throw new Error('Base de datos no disponible.');
  }

  await ensureAuthTableExists();

  try {
    await p.execute(
      `UPDATE usuarios_controlt_registro SET rol = ? WHERE LOWER(usuario_controlt) = ?`,
      [nuevoRol, uTarget]
    );

    return {
      success: true,
      message: `Rol de ${uTarget} actualizado a ${nuevoRol} con éxito.`,
    };
  } catch (err: any) {
    console.error('Error actualizando rol de usuario:', err.message);
    throw err;
  }
}

let configTablesChecked = false;

export async function ensureConfigTablesExists() {
  if (configTablesChecked) return;
  const p = getMySqlPool();
  if (!p) return;

  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS configuracion_sistema (
        clave VARCHAR(64) PRIMARY KEY,
        valor TEXT NOT NULL,
        actualizado_por VARCHAR(120) NULL,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Valores iniciales si no existen
    await p.execute(`
      INSERT INTO configuracion_sistema (clave, valor, actualizado_por)
      VALUES 
        ('piloto_automatico', 'MANUAL', 'sistema'),
        ('piloto_seguimiento', 'MANUAL', 'sistema'),
        ('alertas_seguridad', 'ACTIVO', 'sistema'),
        ('alertas_telegram', '1', 'sistema'),
        ('alertas_whatsapp', '0', 'sistema'),
        ('umbral_velocidad_kmh', '80', 'sistema'),
        ('telegram_chat_id_alertas', '', 'sistema')
      ON DUPLICATE KEY UPDATE clave = clave;
    `);

    await p.execute(`
      CREATE TABLE IF NOT EXISTS alertas_notificadas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo_evento VARCHAR(64) NOT NULL,
        nro_viaje VARCHAR(32) NOT NULL,
        placa VARCHAR(16) NOT NULL,
        conductor VARCHAR(120) NULL,
        telefono VARCHAR(30) NULL,
        cliente VARCHAR(120) NULL,
        velocidad_kmh DECIMAL(5,1) DEFAULT 0,
        ubicacion TEXT NULL,
        descripcion TEXT NULL,
        canal_notificado VARCHAR(32) DEFAULT 'TELEGRAM',
        fecha_notificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_alertas_placa_evento (placa, tipo_evento),
        INDEX idx_alertas_fecha (fecha_notificacion DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    configTablesChecked = true;
  } catch (err: any) {
    console.warn('Advertencia asegurando tablas de configuración:', err.message);
  }
}

/**
 * Obtiene el valor de una clave de configuración global
 */
export async function getConfiguracion(clave: string, defaultValue: string = ''): Promise<string> {
  const p = getMySqlPool();
  if (!p) return defaultValue;

  await ensureConfigTablesExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT valor FROM configuracion_sistema WHERE clave = ? LIMIT 1`,
      [clave]
    );
    if (rows && rows.length > 0) {
      return String(rows[0].valor);
    }
    return defaultValue;
  } catch (err: any) {
    console.error(`Error leyendo configuración ${clave}:`, err.message);
    return defaultValue;
  }
}

/**
 * Guarda o actualiza una clave de configuración en MySQL
 */
export async function setConfiguracion(clave: string, valor: string, actualizadoPor: string = 'sistema'): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  await ensureConfigTablesExists();

  try {
    await p.execute(
      `INSERT INTO configuracion_sistema (clave, valor, actualizado_por)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)`,
      [clave, valor, actualizadoPor]
    );
    return true;
  } catch (err: any) {
    console.error(`Error guardando configuración ${clave}:`, err.message);
    return false;
  }
}

/**
 * Obtiene todas las configuraciones del sistema como objeto clave-valor
 */
export async function getAllConfiguracion(): Promise<Record<string, string>> {
  const p = getMySqlPool();
  const defaults: Record<string, string> = {
    piloto_automatico: 'MANUAL',
    piloto_seguimiento: 'MANUAL',
    alertas_seguridad: 'ACTIVO',
    alertas_telegram: '1',
    alertas_whatsapp: '0',
    umbral_velocidad_kmh: '80',
    telegram_chat_id_alertas: '',
  };

  if (!p) return defaults;

  await ensureConfigTablesExists();

  try {
    const [rows]: any = await p.execute(`SELECT clave, valor FROM configuracion_sistema`);
    const result: Record<string, string> = { ...defaults };
    if (Array.isArray(rows)) {
      for (const r of rows) {
        result[r.clave] = String(r.valor);
      }
    }
    return result;
  } catch (err: any) {
    console.error('Error obteniendo configuraciones globales:', err.message);
    return defaults;
  }
}

/**
 * Control Anti-Spam: Verifica si una alerta para la misma placa y tipo de evento ya fue notificada recientemente
 */
export async function fueAlertaNotificadaRecientemente(
  placa: string,
  tipoEvento: string,
  ventanaMinutos: number = 60
): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  await ensureConfigTablesExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT id FROM alertas_notificadas 
       WHERE placa = ? AND tipo_evento = ? 
       AND fecha_notificacion >= NOW() - INTERVAL ? MINUTE 
       LIMIT 1`,
      [placa.toUpperCase().trim(), tipoEvento.toUpperCase().trim(), ventanaMinutos]
    );

    return Boolean(rows && rows.length > 0);
  } catch (err: any) {
    console.error('Error comprobando alerta reciente:', err.message);
    return false;
  }
}

/**
 * Registra una alerta crítica notificada en la base de datos
 */
export async function registrarAlertaNotificada(params: {
  tipoEvento: string;
  nroViaje: string;
  placa: string;
  conductor?: string;
  telefono?: string;
  cliente?: string;
  velocidadKmh?: number;
  ubicacion?: string;
  descripcion?: string;
  canalNotificado?: string;
}): Promise<boolean> {
  const p = getMySqlPool();
  if (!p) return false;

  await ensureConfigTablesExists();

  try {
    await p.execute(
      `INSERT INTO alertas_notificadas 
       (tipo_evento, nro_viaje, placa, conductor, telefono, cliente, velocidad_kmh, ubicacion, descripcion, canal_notificado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.tipoEvento.toUpperCase(),
        params.nroViaje,
        params.placa.toUpperCase(),
        params.conductor || 'Sin conductor',
        params.telefono || 'N/A',
        params.cliente || 'General',
        params.velocidadKmh || 0,
        params.ubicacion || 'En ruta',
        params.descripcion || '',
        params.canalNotificado || 'TELEGRAM',
      ]
    );
    return true;
  } catch (err: any) {
    console.error('Error registrando alerta notificada:', err.message);
    return false;
  }
}

/**
 * Obtiene el historial de las últimas alertas críticas detectadas
 */
export async function obtenerUltimasAlertasCriticas(limit: number = 30): Promise<any[]> {
  const p = getMySqlPool();
  if (!p) return [];

  await ensureConfigTablesExists();

  try {
    const [rows]: any = await p.execute(
      `SELECT * FROM alertas_notificadas ORDER BY fecha_notificacion DESC LIMIT ?`,
      [limit]
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err: any) {
    console.error('Error consultando últimas alertas:', err.message);
    return [];
  }
}

