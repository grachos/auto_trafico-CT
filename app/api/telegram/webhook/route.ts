import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/telegram-service';
import { trafficAgent } from '@/lib/traffic-agent';
import { registrarAuditoriaDB, verificarSesionUsuario, registrarSesionUsuario, cerrarSesionUsuario } from '@/lib/db';
import { getVehiclesPaginatedDirect, getVehiclesForReport, buildHtmlReport } from '@/lib/report-generator';
import { controltClient } from '@/lib/controlt-service';

function buildPaginationKeyboard(actionTaken?: any) {
  if (actionTaken?.type === 'PAGINATION_AVAILABLE' && actionTaken.pagination) {
    const p = actionTaken.pagination;
    const queryEncoded = encodeURIComponent(p.busqueda || '');
    const keyboard: any[] = [];

    // Fila 1: Botón para siguiente página si aún quedan vehículos
    if (p.proximaPagina && p.proximaPagina <= p.totalPaginas) {
      keyboard.push([
        {
          text: `📄 Ver más vehículos (${p.proximaPagina} de ${p.totalPaginas})`,
          callback_data: `cmd_mas:${queryEncoded}:${p.proximaPagina}`,
        },
      ]);
    }

    // Fila 2: Ver Tabla Completa en Navegador + Descargar Archivo HTML
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auto-trafico-ct.vercel.app';
    const reportUrl = `${appUrl}/api/reportes/tabla?q=${queryEncoded}`;

    keyboard.push([
      {
        text: `🌐 Ver Tabla Completa (${p.total} Vehículos)`,
        url: reportUrl,
      },
      {
        text: `📥 Descargar HTML`,
        callback_data: `cmd_dl_html:${queryEncoded}`,
      },
    ]);

    return keyboard;
  }
  return undefined;
}

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

      // Verificar que el usuario tenga sesión activa en Telegram
      const session = await verificarSesionUsuario('TELEGRAM', String(chatId));
      if (!session.autenticado) {
        await telegramService.sendMessage(
          chatId,
          '🔒 *Acceso Restringido*\n\nDebes identificarte primero con tus credenciales de ControlT:\n`/login <usuario> <contraseña>`'
        );
        return NextResponse.json({ ok: true });
      }

      if (data === 'cmd_atender_lote') {
        const agentResponse = await trafficAgent.processMessage('atiende las alarmas de los viajes a tiempo', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      } else if (data === 'cmd_reporte_eta') {
        const agentResponse = await trafficAgent.processMessage('dame el reporte de semaforo eta', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      } else if (data === 'cmd_criticas') {
        const agentResponse = await trafficAgent.processMessage('cuales son las alarmas criticas activas', 'user');
        await telegramService.sendMessage(chatId, agentResponse.text);
      } else if (data.startsWith('cmd_mas:')) {
        const parts = data.split(':');
        const busqueda = decodeURIComponent(parts[1] || '');
        const pagina = Number(parts[2]) || 2;

        // Cero tokens: Consultar MySQL directamente y formatear en tarjetas
        const result = await getVehiclesPaginatedDirect(busqueda, pagina, 5);
        const keyboard = buildPaginationKeyboard(result.actionTaken);
        await telegramService.sendMessage(chatId, result.text, keyboard);
      } else if (data.startsWith('cmd_dl_html:')) {
        const query = decodeURIComponent(data.split(':')[1] || '');
        const vehicles = await getVehiclesForReport(query);
        const title = query ? `Reporte de Flota: ${query.toUpperCase()}` : 'Reporte General de Flota';
        const html = buildHtmlReport(vehicles, title);
        const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;

        await telegramService.sendDocument(
          chatId,
          html,
          fileName,
          `📊 **${title}** (${vehicles.length} vehículos)\nArchivo de tabla completa interactiva. Puedes abrirlo en cualquier navegador en tu celular o PC e imprimirlo como PDF.`
        );
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

    // Verificar si el usuario ya está autenticado en Telegram
    const session = await verificarSesionUsuario('TELEGRAM', String(chatId));

    // A. Comando para Iniciar Sesión con ControlT: /login <usuario> <contraseña>
    const loginMatch = userText.match(/^\/login(?:\s+(\S+)\s+(.+))?$/i);
    if (loginMatch) {
      const u = loginMatch[1]?.trim();
      const p = loginMatch[2]?.trim();

      if (!u || !p) {
        await telegramService.sendMessage(
          chatId,
          `ℹ️ *Formato de Inicio de Sesión:*\n\nEscribe el comando seguido de tu usuario y contraseña de ControlT:\n\n👉 \`/login <tu_usuario> <tu_contraseña>\`\n\n*Ejemplo:*\n\`/login operador@empresa.com Clave2026*\``
        );
        return NextResponse.json({ ok: true });
      }

      // Validar contra ControlT OAuth
      const authResult = await controltClient.authenticateUser(u, p);
      if (authResult.success) {
        await registrarSesionUsuario({
          usuario: u,
          canal: 'TELEGRAM',
          identificador: String(chatId),
          token: authResult.token,
          nombre: authResult.userName || userName,
        });

        const welcomeText =
          `✅ *¡Autenticación Exitosa con ControlT!* 🚛\n\n` +
          `Bienvenido(a) *${authResult.userName || u}*. Tu cuenta ha sido validada y vinculada a Telegram.\n\n` +
          `Ya puedes monitorear la flota, consultar viajes y atender alarmas con lenguaje natural o usando los botones rápidos:`;

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
      } else {
        await telegramService.sendMessage(
          chatId,
          `❌ *Error de Autenticación en ControlT:*\n\n${authResult.error || 'Credenciales incorrectas. Verifica tu usuario y contraseña de ControlT e intenta nuevamente.'}`
        );
        return NextResponse.json({ ok: true });
      }
    }

    // B. Si el usuario NO está autenticado en Telegram, bloquear y pedir login
    if (!session.autenticado) {
      const authPrompt =
        `🔒 *Acceso Restringido — Torre de Control ControlT* 🚛\n\n` +
        `Hola *${userName}*. Para interactuar con el asistente de tráfico en Telegram debes autenticarte con tus credenciales de ControlT.\n\n` +
        `👉 *Escribe en este chat:*\n` +
        `\`/login <tu_usuario> <tu_contraseña>\`\n\n` +
        `*Ejemplo:*\n` +
        `\`/login operador@empresa.com MiClave123*\`\n\n` +
        `_Tus credenciales se validan en tiempo real contra los servidores seguros de ControlT Tower._`;

      await telegramService.sendMessage(chatId, authPrompt);
      return NextResponse.json({ ok: true });
    }

    // C. Si está autenticado y envía /logout o /salir
    if (userText === '/logout' || userText === '/salir') {
      await cerrarSesionUsuario('TELEGRAM', String(chatId));
      await telegramService.sendMessage(
        chatId,
        `👋 *Sesión cerrada.* Tu cuenta de ControlT (\`${session.usuario}\`) ha sido desconectada de Telegram.\nPara volver a ingresar, usa \`/login\`.`
      );
      return NextResponse.json({ ok: true });
    }

    // D. Si envía /perfil o /quiensoy
    if (userText === '/perfil' || userText === '/quiensoy') {
      await telegramService.sendMessage(
        chatId,
        `👤 *Sesión Activa en ControlT:*\n• **Usuario:** \`${session.usuario}\`\n• **Nombre:** ${session.nombre || session.usuario}\n• **Canal:** Telegram\n\nPara cerrar sesión escribe \`/logout\`.`
      );
      return NextResponse.json({ ok: true });
    }

    // E. Comando /start o /menu para usuario autenticado
    if (userText === '/start' || userText === '/menu') {
      const welcomeText = 
        `👋 *¡Hola ${session.nombre || userName}!* Conectado como \`${session.usuario}\` 🚛\n\n` +
        `Soy el agente inteligente de la Torre de Control ControlT. Puedes usar los botones rápidos o escribir tus instrucciones en lenguaje natural:\n\n` +
        `• *"¿Cómo van los carros de Mabe?"*\n` +
        `• *"Atiende las alarmas de los carros a tiempo"*\n` +
        `• *"Dame el reporte de puntualidad ETA"*\n` +
        `• *"¿Qué alarmas críticas tenemos?"*\n\n` +
        `*(Escribe /logout si deseas cerrar tu sesión).*`;

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

    // F. Cualquier otro mensaje de texto: Procesado por el Agente IA con autoría del usuario
    const agentResponse = await trafficAgent.processMessage(userText, 'user');

    // Si se ejecutó alguna atención, registrar en auditoría DB con el usuario autenticado
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
          usuarioOrigen: session.usuario || userName,
        });
      }
    }

    // Enviar respuesta formateada a Telegram con teclado de paginación si aplica
    const keyboard = buildPaginationKeyboard(agentResponse.actionTaken);
    await telegramService.sendMessage(chatId, agentResponse.text, keyboard);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error procesando webhook de Telegram:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

