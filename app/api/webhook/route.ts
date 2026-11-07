import { NextResponse } from 'next/server';
import { trafficAgent } from '@/lib/traffic-agent';
import { controltClient } from '@/lib/controlt-service';
import { verificarSesionUsuario, registrarSesionUsuario, cerrarSesionUsuario } from '@/lib/db';

// Verificación de Webhook para Meta (WhatsApp / Instagram)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'token_seguro_para_meta_webhooks';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// Recepción de mensajes entrantes desde WhatsApp o Instagram
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Detección de estructura de WhatsApp Cloud API
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messageObj = changes?.value?.messages?.[0];

    let userText = '';
    let fromNumber = '';

    if (messageObj && messageObj.text?.body) {
      userText = messageObj.text.body;
      fromNumber = messageObj.from;
    } else if (body.message) {
      // Formato JSON directo genérico
      userText = body.message;
      fromNumber = body.from || 'Direct-Webhook';
    }

    if (userText && fromNumber) {
      const textTrim = userText.trim();

      // 1. Comando de Login: /login <usuario> <contraseña>
      const loginMatch = textTrim.match(/^\/?login(?:\s+(\S+)\s+(.+))?$/i);
      if (loginMatch) {
        const u = loginMatch[1]?.trim();
        const p = loginMatch[2]?.trim();

        if (!u || !p) {
          return NextResponse.json({
            success: true,
            source: 'WhatsApp Webhook',
            from: fromNumber,
            reply: 'ℹ️ *Formato de Inicio de Sesión ControlT:*\n\nEscribe:\n`/login <tu_usuario> <tu_contraseña>`\n\nEjemplo:\n`/login operador@empresa.com Clave2026*`',
          });
        }

        const authResult = await controltClient.authenticateUser(u, p);
        if (authResult.success) {
          await registrarSesionUsuario({
            usuario: u,
            canal: 'WHATSAPP',
            identificador: fromNumber,
            token: authResult.token,
            nombre: authResult.userName || u,
          });

          return NextResponse.json({
            success: true,
            source: 'WhatsApp Webhook',
            from: fromNumber,
            reply: `✅ *¡Autenticación Exitosa con ControlT!*\n\nBienvenido(a) *${authResult.userName || u}*. Tu número de WhatsApp ha sido vinculado. Ya puedes consultar la flota y atender alarmas con lenguaje natural.`,
          });
        } else {
          return NextResponse.json({
            success: true,
            source: 'WhatsApp Webhook',
            from: fromNumber,
            reply: `❌ *Error en ControlT:*\n\n${authResult.error || 'Credenciales inválidas. Verifica tu usuario y contraseña de ControlT.'}`,
          });
        }
      }

      // 2. Verificar Sesión Activa en WhatsApp
      const session = await verificarSesionUsuario('WHATSAPP', fromNumber);

      // Si envía /logout o salir
      if (textTrim === '/logout' || textTrim.toLowerCase() === 'salir') {
        await cerrarSesionUsuario('WHATSAPP', fromNumber);
        return NextResponse.json({
          success: true,
          source: 'WhatsApp Webhook',
          from: fromNumber,
          reply: '👋 Tu sesión de ControlT ha sido cerrada en WhatsApp. Para volver a ingresar, usa `/login <usuario> <contraseña>`.',
        });
      }

      // Si NO está autenticado, solicitar credenciales
      if (!session.autenticado) {
        return NextResponse.json({
          success: true,
          source: 'WhatsApp Webhook',
          from: fromNumber,
          reply: '🔒 *Acceso Restringido — ControlT*\n\nPara usar el asistente debes identificarte con tus credenciales de ControlT enviando:\n`/login <usuario> <contraseña>`',
        });
      }

      // 3. Procesar texto mediante el motor del agente para usuario autenticado
      const agentResponse = await trafficAgent.processMessage(userText, 'user');

      return NextResponse.json({
        success: true,
        source: 'WhatsApp Webhook',
        from: fromNumber,
        operador: session.nombre || session.usuario,
        input: userText,
        agentReply: agentResponse.text,
        actionTaken: agentResponse.actionTaken,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
