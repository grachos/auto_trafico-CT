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

    const anomaliaEjemplo = {
      tipo: 'ZONA_PROHIBIDA',
      placa: 'LJT025',
      nroViaje: '0101226502',
      conductor: 'EDWIN SANCHEZ',
      telefono: '3103063962',
      cliente: 'SUPPLA CARGO S.A.S.',
      velocidadKmh: 0,
      ubicacion: '45, 478028 Zona Bananera, Colombia',
      descripcion: 'Reporte en telemetría de viaje: SALIDA DE ZONA PROHIBIDA - ZONA PROHIBIDA SEVILLA.',
    };

    const emojiTipo = '⛔ ZONA PROHIBIDA DETECTADA';
    const mensajeTelegram = 
      `🚨 *ALERTA CRÍTICA DE TRÁFICO — ToCIE* 🚛\n\n` +
      `• *Severidad:* ${emojiTipo}\n` +
      `• *Vehículo:* \`${anomaliaEjemplo.placa}\` (Viaje \`${anomaliaEjemplo.nroViaje}\`)\n` +
      `• *Cliente:* ${anomaliaEjemplo.cliente}\n` +
      `• *Conductor:* ${anomaliaEjemplo.conductor}\n` +
      `• *Teléfono:* \`${anomaliaEjemplo.telefono}\` (📞 Toca para llamar)\n` +
      `• *Velocidad:* *${anomaliaEjemplo.velocidadKmh} km/h*\n` +
      `• *Ubicación:* ${anomaliaEjemplo.ubicacion}\n` +
      `• *Detalle:* _${anomaliaEjemplo.descripcion}_\n\n` +
      `⚠️ *Acción Requerida:* Llamar inmediatamente al conductor para verificar novedad.`;

    const mapsQuery = encodeURIComponent(`${anomaliaEjemplo.ubicacion}, Colombia`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
    const cleanPhone = anomaliaEjemplo.telefono.replace(/[^0-9]/g, '');
    const waUrl = cleanPhone.length >= 10 ? `https://wa.me/57${cleanPhone.slice(-10)}` : undefined;

    const actionRow: any[] = [];
    if (waUrl) {
      actionRow.push({ text: `💬 WhatsApp: ${anomaliaEjemplo.telefono}`, url: waUrl });
    }
    actionRow.push({ text: '🗺️ Ver en Google Maps', url: mapsUrl });

    const keyboard: any[] = [
      actionRow,
      [
        { text: '🌐 Abrir Tablero ToCIE', url: 'https://auto-trafico-ct.vercel.app' },
      ],
    ];

    const result = await telegramService.broadcastAlert(mensajeTelegram, keyboard);

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

