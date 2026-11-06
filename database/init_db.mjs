/**
 * SCRIPT DE INICIALIZACIÓN AUTOMÁTICA DE TABLAS EN MYSQL (HOSTINGER)
 * Ejecuta schema_mysql.sql contra srv2184.hstgr.io
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de .env.local si existen
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.trim().split('=');
    if (key && !key.startsWith('#') && values.length > 0) {
      const val = values.join('=').replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

const host = process.env.MYSQL_HOST || 'srv2184.hstgr.io';
const port = Number(process.env.MYSQL_PORT) || 3306;
const password = process.env.MYSQL_PASSWORD;
const database = process.env.MYSQL_DATABASE || 'u279856486_control_T';

const baseUser = process.env.MYSQL_USER;
const usersToTry = [
  baseUser,
  baseUser && !baseUser.startsWith('u279856486_') ? `u279856486_${baseUser}` : null,
  'u279856486_control_T',
].filter(Boolean);

async function init() {
  if (usersToTry.length === 0 || !password) {
    console.error('❌ Falta MYSQL_USER o MYSQL_PASSWORD en .env.local');
    process.exit(1);
  }

  let connection = null;
  let connectedUser = '';

  for (const u of usersToTry) {
    console.log(`🔌 Probando conexión a MySQL en ${host}:${port}/${database} con usuario "${u}"...`);
    try {
      connection = await mysql.createConnection({
        host,
        port,
        user: u,
        password,
        database,
        multipleStatements: true,
        ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
      connectedUser = u;
      console.log(`✅ ¡Conexión exitosa con el usuario "${u}"!`);
      break;
    } catch (err) {
      console.warn(`⚠️ Intento con "${u}" falló: ${err.message}`);
    }
  }

  if (!connection) {
    console.error('\n❌ No fue posible conectar con ninguno de los usuarios probados.');
    console.log('\nPosibles causas en Hostinger:');
    console.log('1. Revisa el nombre exacto del usuario en Hostinger (hPanel -> Bases de datos MySQL).');
    console.log('2. Asegúrate de haber agregado la IP "%" (o tu IP actual) en "MySQL Remoto" (Remote MySQL).');
    console.log('3. Confirma que el usuario tenga todos los privilegios asignados a la base de datos "u279856486_control_T".\n');
    process.exit(1);
  }

  try {
    const sqlFilePath = path.resolve(__dirname, 'schema_mysql.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📜 Ejecutando script de creación de tablas (schema_mysql.sql)...');
    await connection.query(sqlContent);

    console.log('🎉 ¡Todas las tablas y reglas iniciales han sido creadas exitosamente en Hostinger!');

    // Verificar tablas creadas
    const [rows] = await connection.query('SHOW TABLES');
    console.log('\n📋 Tablas presentes en u279856486_control_T:');
    console.table(rows);

    await connection.end();
  } catch (err) {
    console.error('❌ Error ejecutando schema en MySQL:', err.message);
    process.exit(1);
  }
}

init();
