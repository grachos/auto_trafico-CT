import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/telegram-service';
import { trafficAgent } from '@/lib/traffic-agent';
import {
  registrarAuditoriaDB,
  verificarSesionUsuario,
  registrarSesionUsuario,
  cerrarSesionUsuario,
  verificarORegistrarUsuarioGlobal,
  verificarEstadoUsuario,
  getConfiguracion,
  setConfiguracion,
  obtenerUltimasAlertasCriticas,
  esUsuarioAdmin,
} from '@/lib/db';
import { getVehiclesPaginatedDirect, getVehiclesForReport, buildHtmlReport } from '@/lib/report-generator';
import { controltClient } from '@/lib/controlt-service';

function buildPaginationKeyboard(actionTaken?: any) {
  if (actionTaken?.type === 'PAGINATION_AVAILABLE' && actionTaken.pagination) {
    const p = actionTaken.pagination;
    const queryEncoded = encodeURIComponent(p.busqueda || '');
    const semaforo = p.filtroSemaforo || 'TODOS';
    const velocidad = p.filtroVelocidad || 'TODOS';
    const minAvance = p.minPorcentajeAvance !== undefined && p.minPorcentajeAvance !== null ? p.minPorcentajeAvance : '';
    const maxAvance = p.maxPorcentajeAvance !== undefined && p.maxPorcentajeAvance !== null ? p.maxPorcentajeAvance : '';

    const filterTag = `${queryEncoded}:${semaforo}:${velocidad}:${minAvance}:${maxAvance}`;
    const keyboard: any[] = [];

    // Fila 1: Botón para siguiente página si aún quedan vehículos
    if (p.proximaPagina && p.proximaPagina <= p.totalPaginas) {
      keyboard.push([
        {
          text: `📄 Ver más vehículos (${p.proximaPagina} de ${p.totalPaginas})`,
          callback_data: `cmd_mas:${p.proximaPagina}:${filterTag}`,
        },
      ]);
    }

    // Fila 2: Ver Tabla Completa en Navegador + Descargar Archivo HTML
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auto-trafico-ct.vercel.app';
    const reportUrl = `${appUrl}/api/reportes/tabla?q=${queryEncoded}&semaforo=${semaforo}&velocidad=${velocidad}&minAvance=${minAvance}&maxAvance=${maxAvance}`;

    keyboard.push([
      {
        text: `🌐 Ver Tabla Completa (${p.total} Vehículos)`,
        url: reportUrl,
      },
      {
        text: `📥 Descargar HTML`,
        callback_data: `cmd_dl_html:${filterTag}`,
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
      if (!session.autenticado || !session.usuario) {
        await telegramService.sendMessage(
          chatId,
          '🔒 *Acceso Restringido*\n\nDebes identificarte primero con tus credenciales de ControlT:\n`/login <usuario> <contraseña>`'
        );
        return NextResponse.json({ ok: true });
      }

      // Verificar si el usuario fue desactivado por el administrador
      const estadoGlobalCallback = await verificarEstadoUsuario(session.usuario);
      if (estadoGlobalCallback.estado === 'INACTIVO') {
        await cerrarSesionUsuario('TELEGRAM', String(chatId));
        await telegramService.sendMessage(
          chatId,
          `❌ *Acceso Suspendido*\n\nTu usuario (\`${session.usuario}\`) se encuentra **INACTIVO** en la plataforma.\nComunícate con el administrador (\`ggomez@elogia.com.co\`) para solicitar activación.`
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
      } else if (data === 'cmd_movimiento') {
        const direct = await getVehiclesPaginatedDirect('', 1, 5, 'TODOS', 'EN_MOVIMIENTO');
        const keyboard = buildPaginationKeyboard(direct.actionTaken);
        await telegramService.sendMessage(chatId, `🚚 *Vehículos en Movimiento (Velocidad > 0 km/h):*\n\n${direct.text}`, keyboard);
      } else if (data === 'cmd_quietos') {
        const direct = await getVehiclesPaginatedDirect('', 1, 5, 'TODOS', 'DETENIDO');
        const keyboard = buildPaginationKeyboard(direct.actionTaken);
        await telegramService.sendMessage(chatId, `🛑 *Vehículos Detenidos / Estacionados (Velocidad = 0 km/h):*\n\n${direct.text}`, keyboard);
      } else if (data.startsWith('cmd_mas:')) {
        const parts = data.split(':');
        let pagina = 2;
        let busqueda = '';
        let semaforo = 'TODOS';
        let velocidad = 'TODOS';
        let minAvance: number | undefined = undefined;
        let maxAvance: number | undefined = undefined;

        // Soporta formato nuevo: cmd_mas:pagina:busqueda:semaforo:velocidad:minAvance:maxAvance
        if (!isNaN(Number(parts[1]))) {
          pagina = Number(parts[1]) || 2;
          busqueda = decodeURIComponent(parts[2] || '');
          semaforo = parts[3] || 'TODOS';
          velocidad = parts[4] || 'TODOS';
          if (parts[5] && !isNaN(Number(parts[5]))) minAvance = Number(parts[5]);
          if (parts[6] && !isNaN(Number(parts[6]))) maxAvance = Number(parts[6]);
        } else {
          // Retrocompatible: cmd_mas:busqueda:pagina
          busqueda = decodeURIComponent(parts[1] || '');
          pagina = Number(parts[2]) || 2;
        }

        // Cero tokens: Consultar MySQL directamente y formatear en tarjetas
        const result = await getVehiclesPaginatedDirect(
          busqueda,
          pagina,
          5,
          semaforo as any,
          velocidad as any,
          minAvance,
          maxAvance
        );
        const keyboard = buildPaginationKeyboard(result.actionTaken);
        await telegramService.sendMessage(chatId, result.text, keyboard);
      } else if (data.startsWith('cmd_dl_html:')) {
        const parts = data.split(':');
        const query = decodeURIComponent(parts[1] || '');
        const semaforo = parts[2] || 'TODOS';
        const velocidad = parts[3] || 'TODOS';
        const minAvance = parts[4] && !isNaN(Number(parts[4])) ? Number(parts[4]) : undefined;
        const maxAvance = parts[5] && !isNaN(Number(parts[5])) ? Number(parts[5]) : undefined;

        const vehicles = await getVehiclesForReport(
          query,
          semaforo as any,
          velocidad as any,
          minAvance,
          maxAvance
        );
        const title = query ? `Reporte de Flota: ${query.toUpperCase()}` : 'Reporte de Flota';
        const html = buildHtmlReport(vehicles, title);
        const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;

        await telegramService.sendDocument(
          chatId,
          html,
          fileName,
          `📊 **${title}** (${vehicles.length} vehículos)\nArchivo de tabla completa interactiva. Puedes abrirlo en cualquier navegador en tu celular o PC e imprimirlo como PDF.`
        );
      } else if (data === 'cmd_toggle_piloto') {
        const isAdmin = session.usuario?.toLowerCase().trim() === 'ggomez@elogia.com.co';
        if (!isAdmin) {
          await telegramService.sendMessage(
            chatId,
            `🔒 *Permiso Denegado*\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) tiene autorización para cambiar el modo del Piloto Automático.`
          );
          return NextResponse.json({ ok: true });
        }

        const estadoActual = await getConfiguracion('piloto_automatico', 'MANUAL');
        const nuevoEstado = estadoActual === 'ACTIVO' ? 'MANUAL' : 'ACTIVO';
        await setConfiguracion('piloto_automatico', nuevoEstado, session.usuario);

        const msg = nuevoEstado === 'ACTIVO'
          ? `🟢 *Piloto Automático ACTIVADO*\n\nToCIE ahora:\n• Sincronizará la flota cada 10 minutos desde Hostinger.\n• Atenderá llamadas de seguimiento de viajes a tiempo.\n• Te alertará de inmediato ante eventos críticos (fuera de ruta, zona prohibida o exceso de velocidad).`
          : `⏸️ *Piloto Automático en modo MANUAL*\n\nSe ha pausado la atención automática desatendida. El monitoreo de alertas críticas de seguridad continúa activo.`;

        await telegramService.sendMessage(chatId, msg);
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
        // Verificar estado de autorización del usuario en la plataforma
        const estadoGlobal = await verificarORegistrarUsuarioGlobal({
          usuario: u,
          nombre: authResult.userName || userName,
          canal: 'TELEGRAM',
        });

        if (estadoGlobal.estado === 'INACTIVO') {
          await telegramService.sendMessage(
            chatId,
            `❌ *Acceso Denegado*\n\nTu usuario de ControlT (\`${u}\`) se encuentra **INACTIVO** en la plataforma.\n\nComunícate con el administrador (\`ggomez@elogia.com.co\`) para solicitar activación.`
          );
          return NextResponse.json({ ok: true });
        }

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

    // B2. Si está autenticado pero fue desactivado por el administrador
    if (session.usuario) {
      const estadoGlobalText = await verificarEstadoUsuario(session.usuario);
      if (estadoGlobalText.estado === 'INACTIVO') {
        await cerrarSesionUsuario('TELEGRAM', String(chatId));
        await telegramService.sendMessage(
          chatId,
          `❌ *Acceso Suspendido*\n\nTu usuario de ControlT (\`${session.usuario}\`) ha sido desactivado en la plataforma.\nComunícate con el administrador (\`ggomez@elogia.com.co\`) para solicitar activación.`
        );
        return NextResponse.json({ ok: true });
      }
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
      const estadoPiloto = await getConfiguracion('piloto_automatico', 'MANUAL');
      const estadoAlertas = await getConfiguracion('alertas_seguridad', 'ACTIVO');
      const welcomeText = 
        `👋 *¡Hola ${session.nombre || userName}!* Conectado como \`${session.usuario}\` 🚛\n\n` +
        `Bienvenido a la **Torre de Control Inteligente Elogia (ToCIE)**.\n` +
        `• *Piloto Seguimiento:* **${estadoPiloto}**\n` +
        `• *Alertas Críticas:* **${estadoAlertas}**\n\n` +
        `💡 *Escribe \`/comandos\` para ver la lista completa de acciones disponibles.*`;

      const keyboard = [
        [
          { text: '🚚 En Movimiento (>0 km/h)', callback_data: 'cmd_movimiento' },
          { text: '🛑 Detenidos (=0 km/h)', callback_data: 'cmd_quietos' },
        ],
        [
          { text: '📊 Semáforo ETA', callback_data: 'cmd_reporte_eta' },
          { text: '🚨 Alarmas Críticas', callback_data: 'cmd_criticas' },
        ],
        [
          { text: '⚡ Atender Alarmas a Tiempo', callback_data: 'cmd_atender_lote' },
          { text: '🌐 Abrir Tablero ToCIE', url: 'https://auto-trafico-ct.vercel.app' },
        ],
      ];

      await telegramService.sendMessage(chatId, welcomeText, keyboard);
      return NextResponse.json({ ok: true });
    }

    const userTextLower = userText.toLowerCase().trim();
    const isAdmin = session.usuario ? await esUsuarioAdmin(session.usuario) : false;

    // E.1. Catálogo de Comandos (/comando, /comandos, /ayuda, /help)
    if (
      userTextLower === '/comando' ||
      userTextLower === '/comandos' ||
      userTextLower === '/ayuda' ||
      userTextLower === '/help'
    ) {
      const comandosText =
        `📋 *CATÁLOGO DE COMANDOS — TORRE ToCIE* 🚛\n\n` +
        `🔍 *CONSULTAS OPERATIVAS:*\n` +
        `• \`/menu\` — Menú con botones de acceso rápido.\n` +
        `• \`/criticas\` — Listado de alarmas de seguridad activas.\n` +
        `• \`/movimiento\` (o \`/andando\`) — Vehículos rodando en este momento (velocidad > 0 km/h).\n` +
        `• \`/quietos\` (o \`/detenidos\`) — Vehículos parados o estacionados (velocidad = 0 km/h).\n` +
        `• \`/eta\` (o \`/resumen\`) — Semáforo de puntualidad de la flota.\n` +
        `• \`/reporte\` — Genera y descarga el archivo completo en HTML / PDF.\n` +
        `• \`/estado\` (o \`/cron\`) — Diagnóstico en tiempo real del cron de Hostinger y salud del sistema.\n\n` +
        `⚡ *AUTOMATIZACIÓN & CONTROL (ADMIN):*\n` +
        `• \`/seguimiento on\` — Activa el piloto de atención para llamadas de viajes a tiempo.\n` +
        `• \`/seguimiento off\` — Pausa el piloto de seguimiento (modo manual).\n` +
        `• \`/alertas on\` — Activa notificaciones inmediatas de seguridad (fuera de ruta, zonas rojas, velocidad).\n` +
        `• \`/alertas off\` — Pausa las notificaciones de alertas.\n\n` +
        `👤 *SESIÓN Y CUENTA:*\n` +
        `• \`/login <usuario> <clave>\` — Vincular tu cuenta de ControlT.\n` +
        `• \`/perfil\` — Ver tu usuario conectado.\n` +
        `• \`/logout\` — Desconectar tu sesión de Telegram.\n\n` +
        `💬 *LENGUAJE NATURAL:*\n` +
        `También puedes escribir preguntas cotidianas como:\n` +
        `• *"¿Qué carros van andando?"*\n` +
        `• *"Muéstrame los vehículos de Terpel"*\n` +
        `• *"Atiende las alarmas de los carros a tiempo"*\n` +
        `• *"¿Dónde está la placa KNL064?"*`;

      const keyboard = [
        [
          { text: '🚚 En Movimiento', callback_data: 'cmd_movimiento' },
          { text: '🛑 Detenidos', callback_data: 'cmd_quietos' },
        ],
        [
          { text: '📊 Semáforo ETA', callback_data: 'cmd_reporte_eta' },
          { text: '🚨 Alarmas Críticas', callback_data: 'cmd_criticas' },
        ],
        [
          { text: '🌐 Abrir Tablero ToCIE', url: 'https://auto-trafico-ct.vercel.app' },
        ],
      ];

      await telegramService.sendMessage(chatId, comandosText, keyboard);
      return NextResponse.json({ ok: true });
    }

    // E.2. Comando Directo de Vehículos en Movimiento (/movimiento, /andando, /rodando)
    if (
      userTextLower === '/movimiento' ||
      userTextLower === '/andando' ||
      userTextLower === '/rodando'
    ) {
      const direct = await getVehiclesPaginatedDirect('', 1, 5, 'TODOS', 'EN_MOVIMIENTO');
      const keyboard = buildPaginationKeyboard(direct.actionTaken);
      await telegramService.sendMessage(chatId, `🚚 *Vehículos en Movimiento (Velocidad > 0 km/h):*\n\n${direct.text}`, keyboard);
      return NextResponse.json({ ok: true });
    }

    // E.3. Comando Directo de Vehículos Detenidos (/quietos, /detenidos, /parados)
    if (
      userTextLower === '/quietos' ||
      userTextLower === '/detenidos' ||
      userTextLower === '/parados'
    ) {
      const direct = await getVehiclesPaginatedDirect('', 1, 5, 'TODOS', 'DETENIDO');
      const keyboard = buildPaginationKeyboard(direct.actionTaken);
      await telegramService.sendMessage(chatId, `🛑 *Vehículos Detenidos / Estacionados (Velocidad = 0 km/h):*\n\n${direct.text}`, keyboard);
      return NextResponse.json({ ok: true });
    }

    // E.4. Diagnóstico del Cron y Salud del Sistema (/estado, /cron)
    if (userTextLower === '/estado' || userTextLower === '/cron') {
      const estadoSeguimiento = await getConfiguracion('piloto_seguimiento', 'MANUAL');
      const estadoAlertas = await getConfiguracion('alertas_seguridad', 'ACTIVO');
      const ultimoCron = await getConfiguracion('ultimo_cron_ejecutado', 'Sin registro reciente');
      const ultimasAlertas = await obtenerUltimasAlertasCriticas(5);

      const msg = 
        `⏱️ *Diagnóstico del Sistema y Cron ToCIE* 🚛\n\n` +
        `• ⚡ **Piloto de Seguimiento:** *${estadoSeguimiento}*\n` +
        `• 🚨 **Alertas de Seguridad:** *${estadoAlertas}*\n` +
        `• 🕒 **Última Sincronización:** ${ultimoCron}\n` +
        `• 📡 **Alertas Críticas Recientes:** ${ultimasAlertas.length} registradas\n` +
        `• ☁️ **Arquitectura:** Hostinger Cron (cada 10m) ➔ Vercel ➔ MySQL\n\n` +
        `_El motor autónomo vigila 24/7. Si no hay nuevas anomalías o ya fueron notificadas en los últimos 60 min, el cron opera en silencio para evitar saturación._`;

      const keyboard = [
        [
          { text: '🚨 Ver Anomalías Activas', callback_data: 'cmd_criticas' },
          { text: '📊 Semáforo ETA', callback_data: 'cmd_reporte_eta' },
        ],
        [
          { text: '🌐 Abrir Tablero Web', url: 'https://auto-trafico-ct.vercel.app' },
        ],
      ];

      await telegramService.sendMessage(chatId, msg, keyboard);
      return NextResponse.json({ ok: true });
    }

    // E.5. Comando Directo de Reporte Semáforo ETA (/eta, /resumen)
    if (userTextLower === '/eta' || userTextLower === '/resumen') {
      const agentResponse = await trafficAgent.processMessage('dame el reporte de semaforo eta', 'user');
      await telegramService.sendMessage(chatId, agentResponse.text);
      return NextResponse.json({ ok: true });
    }

    // E.6. Comando Directo de Descarga de Reporte HTML/PDF (/reporte, /tabla, /excel, /pdf)
    if (userTextLower === '/reporte' || userTextLower === '/tabla' || userTextLower === '/excel' || userTextLower === '/pdf') {
      const vehicles = await getVehiclesForReport('');
      const title = 'Reporte General de Flota ToCIE';
      const html = buildHtmlReport(vehicles, title);
      const fileName = `Reporte_Flota_${new Date().toISOString().slice(0, 10)}.html`;

      await telegramService.sendDocument(
        chatId,
        html,
        fileName,
        `📊 *${title}* (${vehicles.length} vehículos)\nArchivo de tabla completa interactiva. Puedes abrirlo en cualquier navegador en tu celular o PC e imprimirlo como PDF o exportar a Excel.`
      );
      return NextResponse.json({ ok: true });
    }

    // F. Comandos del Piloto de Seguimiento (/seguimiento, /piloto, on/off)
    if (
      userTextLower.startsWith('/seguimiento') ||
      userTextLower.startsWith('/piloto') ||
      userTextLower.includes('piloto seguimiento') ||
      userTextLower.includes('piloto automatico') ||
      userTextLower.includes('piloto automático')
    ) {
      if (
        userTextLower.includes('on') ||
        userTextLower.includes('activ') ||
        userTextLower.includes('prend') ||
        userTextLower.includes('inici')
      ) {
        if (!isAdmin) {
          await telegramService.sendMessage(
            chatId,
            `🔒 *Permiso Denegado*\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) tiene autorización para activar el Piloto de Seguimiento.`
          );
          return NextResponse.json({ ok: true });
        }
        await setConfiguracion('piloto_seguimiento', 'ACTIVO', session.usuario);
        await setConfiguracion('piloto_automatico', 'ACTIVO', session.usuario);
        await telegramService.sendMessage(
          chatId,
          `⚡ *Piloto de Seguimiento ACTIVADO*\n\nToCIE ahora atenderá y cerrará en ControlT las llamadas de seguimiento de viajes que van *A Tiempo* cada 10 minutos desde Hostinger.\n\n_(Nota: El monitoreo y notificación de alertas críticas de seguridad se gestiona de forma independiente con \`/alertas\`)_.`
        );
        return NextResponse.json({ ok: true });
      }

      if (
        userTextLower.includes('off') ||
        userTextLower.includes('desactiv') ||
        userTextLower.includes('apag') ||
        userTextLower.includes('paus') ||
        userTextLower.includes('deten')
      ) {
        if (!isAdmin) {
          await telegramService.sendMessage(
            chatId,
            `🔒 *Permiso Denegado*\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) tiene autorización para pausar el Piloto de Seguimiento.`
          );
          return NextResponse.json({ ok: true });
        }
        await setConfiguracion('piloto_seguimiento', 'MANUAL', session.usuario);
        await setConfiguracion('piloto_automatico', 'MANUAL', session.usuario);
        await telegramService.sendMessage(
          chatId,
          `⏸️ *Piloto de Seguimiento en modo MANUAL*\n\nSe ha pausado la atención automática en ControlT. Los operadores deben atender las alarmas manualmente.`
        );
        return NextResponse.json({ ok: true });
      }

      // Consulta de estado actual
      const estadoSeguimiento = await getConfiguracion('piloto_seguimiento', 'MANUAL');
      const estadoAlertas = await getConfiguracion('alertas_seguridad', 'ACTIVO');
      await telegramService.sendMessage(
        chatId,
        `📋 *Estado de Automatización ToCIE:*\n\n` +
        `• ⚡ **Piloto de Seguimiento (ControlT):** *${estadoSeguimiento}*\n` +
        `• 🚨 **Monitoreo Crítico (Alertas Telegram):** *${estadoAlertas}*\n\n` +
        `• **Gestión:** Exclusiva de \`ggomez@elogia.com.co\`\n\n` +
        `${isAdmin ? '_(Para alternar seguimiento: \\`/seguimiento on\\` o \\`/seguimiento off\\`)_\n_(Para alternar alertas: \\`/alertas on\\` o \\`/alertas off\\`)_' : ''}`
      );
      return NextResponse.json({ ok: true });
    }

    // G. Control y Consulta de Alertas Críticas (/alertas, /alertas on, /alertas off)
    if (userTextLower.startsWith('/alertas') || userTextLower.startsWith('/criticas') || userTextLower.includes('alertas criticas') || userTextLower.includes('alertas críticas')) {
      if (userTextLower.includes('on') || userTextLower.includes('activ') || userTextLower.includes('prend')) {
        if (!isAdmin) {
          await telegramService.sendMessage(
            chatId,
            `🔒 *Permiso Denegado*\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) puede activar las alertas de seguridad.`
          );
          return NextResponse.json({ ok: true });
        }
        await setConfiguracion('alertas_seguridad', 'ACTIVO', session.usuario);
        await setConfiguracion('alertas_telegram', '1', session.usuario);
        await telegramService.sendMessage(
          chatId,
          `🚨 *Alertas Críticas de Seguridad ACTIVADAS*\n\nToCIE te notificará de inmediato ante:\n• Camiones fuera de ruta o desvíos\n• Ingreso a zonas prohibidas\n• Excesos de velocidad (> 80 km/h)`
        );
        return NextResponse.json({ ok: true });
      }

      if (userTextLower.includes('off') || userTextLower.includes('desactiv') || userTextLower.includes('apag') || userTextLower.includes('paus')) {
        if (!isAdmin) {
          await telegramService.sendMessage(
            chatId,
            `🔒 *Permiso Denegado*\n\nSolo el administrador principal (\`ggomez@elogia.com.co\`) puede pausar las alertas de seguridad.`
          );
          return NextResponse.json({ ok: true });
        }
        await setConfiguracion('alertas_seguridad', 'PAUSA', session.usuario);
        await setConfiguracion('alertas_telegram', '0', session.usuario);
        await telegramService.sendMessage(
          chatId,
          `⏸️ *Alertas Críticas de Seguridad PAUSADAS*\n\nNo se enviarán notificaciones de anomalías a Telegram hasta que se reactiven.`
        );
        return NextResponse.json({ ok: true });
      }

      // Consulta de últimas alertas
      const ultimas = await obtenerUltimasAlertasCriticas(5);
      const estadoAlertas = await getConfiguracion('alertas_seguridad', 'ACTIVO');
      if (ultimas.length === 0) {
        await telegramService.sendMessage(
          chatId,
          `🔔 *Monitoreo Crítico (${estadoAlertas}):*\n\n✅ Sin anomalías de seguridad registradas en las últimas horas.`
        );
      } else {
        let txt = `🚨 *Últimas ${ultimas.length} Alertas Críticas (Estado: ${estadoAlertas}):*\n\n`;
        for (const a of ultimas) {
          txt += `• \`${a.placa}\` (*${a.tipo_evento}*): ${a.descripcion} — _${new Date(a.fecha_notificacion).toLocaleTimeString()}_\n`;
        }
        await telegramService.sendMessage(chatId, txt);
      }
      return NextResponse.json({ ok: true });
    }

    // H. Cualquier otro mensaje de texto: Procesado por el Agente IA con autoría del usuario
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

