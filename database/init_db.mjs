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
const user = process.env.MYSQL_USER;
const password = process.env.MYSQL_PASSWORD;
const database = process.env.MYSQL_DATABASE || 'u279856486_control_T';

async function init() {
  if (!user || !password) {
    console.error('❌ Falta MYSQL_USER o MYSQL_PASSWORD en .env.local');
    console.log('Edita el archivo .env.local y coloca:');
    console.log('MYSQL_USER=tu_usuario');
    console.log('MYSQL_PASSWORD=tu_password');
    process.exit(1);
  }

  console.log(`🔌 Conectando a MySQL en ${host}:${port}/${database} con usuario ${user}...`);

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    console.log('✅ Conexión establecida con éxito.');

    const sqlFilePath = path.resolve(__dirname, 'schema_mysql.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📜 Ejecutando script de creación de tablas (schema_mysql.sql)...');
    await connection.query(sqlContent);

    console.log('🎉 ¡Todas las tablas y reglas iniciales han sido creadas exitosamente en Hostinger!');

    // Verificar tablas creadas
    const [rows] = await connection.query('SHOW TABLES');
    console.log('Tablas presentes en u279856486_control_T:');
    console.table(rows);

    await connection.end();
  } catch (err) {
    console.error('❌ Error ejecutando schema en MySQL:', err.message);
    process.exit(1);
  }
}

init();
