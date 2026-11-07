import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/telegram-service';
import { getMySqlPool, getAllConfiguracion } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const config = await getAllConfiguracion();
    const pool = getMySqlPool();

    // Diagnóstico previo de destinatarios
    const destinatarios: any = {
      telegram_usuarios_autorizados: [],
      usuarios_controlt_sesiones: [],
      configuracion_telegram_chat_id: config.telegram_chat_id_alertas || null,
      env_alerts_chat_id: process.env.TELEGRAM_ALERTS_CHAT_ID || null,
    };

    if (pool) {
      try {
        const [r1]: any = await pool.execute(
          'SELECT chat_id, nombre, usuario_controlt FROM telegram_usuarios_autorizados WHERE notificaciones_activas = 1'
        );
        destinatarios.telegram_usuarios_autorizados = r1;
      } catch (e: any) {
        destinatarios.error_autorizados = e.message;
      }

      try {
        const [r2]: any = await pool.execute(
          "SELECT id, usuario_controlt, identificador_canal as chat_id, activo FROM usuarios_controlt_sesiones WHERE canal = 'TELEGRAM' AND activo = 1"
        );
        destinatarios.usuarios_controlt_sesiones = r2;
      } catch (e: any) {
        destinatarios.error_sesiones = e.message;
      }
    }

    const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' });
    const mensajePrueba = 
      `🚨 *PRUEBA DE ALERTA DE SEGURIDAD — ToCIE* 🚛\n\n` +
      `• *Estado:* ✅ Notificaciones de Telegram Operativas\n` +
      `• *Hora de Prueba:* ${hora}\n` +
      `• *Plataforma:* Elogia Soluciones Logísticas\n` +
      `• *Canal:* Alertas de Tráfico en Vivo\n\n` +
      `_Si estás leyendo este mensaje, tu cuenta de Telegram está correctamente vinculada para recibir alertas críticas de seguridad (fuera de ruta, zonas prohibidas y excesos de velocidad)._`;

    const keyboard = [
      [
        { text: '🌐 Abrir Tablero ToCIE', url: 'https://auto-trafico-ct.vercel.app' },
      ],
    ];

    const result = await telegramService.broadcastAlert(mensajePrueba, keyboard);

    return NextResponse.json({
      success: true,
      mensaje: result.sent > 0 ? 'Alerta de prueba enviada exitosamente a Telegram.' : 'No se pudo entregar a ningún destinatario.',
      resultado: result,
      diagnostico: destinatarios,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
