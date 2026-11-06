import { NextResponse } from 'next/server';
import { trafficAgent } from '@/lib/traffic-agent';

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

    if (userText) {
      // Procesar texto mediante el motor del agente
      const agentResponse = await trafficAgent.processMessage(userText, 'user');

      // Aquí se enviaría el mensaje de vuelta a WhatsApp Cloud API usando fetch a graph.facebook.com
      // En este endpoint retornamos la respuesta procesada
      return NextResponse.json({
        success: true,
        source: 'WhatsApp/Instagram Webhook',
        from: fromNumber,
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

