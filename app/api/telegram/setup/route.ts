import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/telegram-service';

export async function GET(request: Request) {
  if (!telegramService.isConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN no está configurado en las variables de entorno de Vercel.',
    }, { status: 400 });
  }

  // Detectar la URL del host automáticamente (ej: https://auto-trafico-ct.vercel.app)
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const result = await telegramService.setWebhook(webhookUrl, secret);

    return NextResponse.json({
      success: true,
      message: 'Webhook de Telegram configurado exitosamente.',
      webhookUrl,
      telegramResponse: result,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}

