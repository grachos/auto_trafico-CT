import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/telegram-service';
import { trafficAgent } from '@/lib/traffic-agent';
import { registrarAuditoriaDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // 1. Manejo de Callback Queries (Clics en botones del teclado inline)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const data = callback.data;
      const fromUser = callback.from?.first_name || 'Operador Telegram';

      if (!chatId) return NextResponse.json({ ok: true });

      if (data === 'cmd_atender_lote') {
        const agentResponse = await trafficAgent.processMessage('atiende las alarmas de los viajes a tiempo', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      } else if (data === 'cmd_reporte_eta') {
        const agentResponse = await trafficAgent.processMessage('dame el reporte de semaforo eta', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      } else if (data === 'cmd_criticas') {
        const agentResponse = await trafficAgent.processMessage('cuales son las alarmas criticas activas', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Manejo de Mensajes de Texto de Usuario
    const message = update.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const userName = message.from?.first_name || message.from?.username || 'Usuario';

    // Comando /start o /menu
    if (userText === '/start' || userText === '/menu') {
      const welcomeText = 
        `👋 *¡Hola ${userName}! Bienvenido a la Torre de Control ControlT (IA Traffic Bot)* 🚛\n\n` +
        `Soy el agente inteligente de monitoreo y atención de tráfico. Puedes interactuar conmigo con los botones rápidos o escribir tus instrucciones en lenguaje natural:\n\n` +
        `• *"Atiende las alarmas de los carros a tiempo"*\n` +
        `• *"Dame el reporte de puntualidad ETA"*\n` +
        `• *"¿Qué alarmas críticas tenemos?"*\n` +
        `• *"Atiende el viaje 0101226422"*`;

      const keyboard = [
        [
          { text: '⚡ Atender Alarmas a Tiempo', callback_data: 'cmd_atender_lote' },
          { text: '📊 Semáforo ETA', callback_data: 'cmd_reporte_eta' },
        ],
        [
          { text: '🚨 Alarmas Críticas', callback_data: 'cmd_criticas' },
          { text: '🌐 Abrir Dashboard Web', url: 'https://auto-trafico-ct.vercel.app' },
        ],
      ];

      await telegramService.sendMessage(chatId, welcomeText, keyboard);
      return NextResponse.json({ ok: true });
    }

    // Cualquier otro mensaje de texto: Procesado por el Agente IA
    const agentResponse = await trafficAgent.processMessage(userText, 'user');

    // Si se ejecutó alguna atención, registrar en auditoría DB
    if (agentResponse.actionTaken && agentResponse.actionTaken.type === 'ATTEND_BATCH') {
      const details = agentResponse.actionTaken.details || [];
      for (const a of details) {
        await registrarAuditoriaDB({
          alarmaId: a.id,
          nroViaje: a.nroViaje,
          placa: a.placa,
          novedad: a.novedadAplicada || 'En ruta sin novedad alguna',
          comentario: a.comentarioRegistrado || '',
          canalOrigen: 'TELEGRAM',
          usuarioOrigen: userName,
        });
      }
    }

    // Enviar respuesta formateada a Telegram
    await telegramService.sendMessage(chatId, agentResponse.text);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error procesando webhook de Telegram:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

