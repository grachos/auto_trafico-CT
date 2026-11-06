import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { testMySqlConnection } from '@/lib/db';
import { telegramService } from '@/lib/telegram-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // 1. Diagnóstico de Conexión con ControlT
  try {
    const isConfigured = controltClient.isConfigured();
    if (!isConfigured) {
      health.services.controlt = {
        status: 'UNCONFIGURED',
        message: 'Faltan CONTROLT_USERNAME y CONTROLT_PASSWORD en variables de entorno.',
      };
    } else {
      const token = await controltClient.getValidToken();
      if (token) {
        health.services.controlt = {
          status: 'CONNECTED',
          message: 'Autenticación OAuth exitosa y token vigente obtenido.',
          apiBaseUrl: process.env.CONTROLT_API_BASE_URL || 'https://tower-api.controlt.com.co',
        };
      } else {
        health.services.controlt = {
          status: 'AUTH_FAILED',
          message: controltClient.getLastError() || 'No se pudo generar el token. Verifica usuario y contraseña.',
        };
      }
    }
  } catch (err: any) {
    health.services.controlt = {
      status: 'ERROR',
      error: err.message,
    };
  }

  // 2. Diagnóstico de Conexión con MySQL (Hostinger)
  try {
    const mysqlTest = await testMySqlConnection();
    health.services.mysql = {
      status: mysqlTest.connected ? 'CONNECTED' : 'DISCONNECTED',
      server: process.env.MYSQL_HOST || 'srv2184.hstgr.io',
      database: process.env.MYSQL_DATABASE || 'u279856486_control_T',
      message: mysqlTest.message,
      version: mysqlTest.version,
    };
  } catch (err: any) {
    health.services.mysql = {
      status: 'ERROR',
      error: err.message,
    };
  }

  // 3. Diagnóstico de Bot de Telegram
  try {
    health.services.telegram = {
      status: telegramService.isConfigured() ? 'CONFIGURED' : 'UNCONFIGURED',
      message: telegramService.isConfigured()
        ? 'Token configurado. Visita /api/telegram/setup para activar el webhook.'
        : 'TELEGRAM_BOT_TOKEN no configurado.',
    };
  } catch (err: any) {
    health.services.telegram = {
      status: 'ERROR',
      error: err.message,
    };
  }

  return NextResponse.json(health);
}
