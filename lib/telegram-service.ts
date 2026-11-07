import { cleanAndFormatAIText } from './format-utils';

function splitTelegramChunks(text: string, maxLen: number = 3800): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  const cards = text.split('\n\n');
  let currentChunk = '';

  for (const card of cards) {
    if ((currentChunk + '\n\n' + card).length > maxLen) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = card;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + card : card;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export class TelegramService {
  private botToken: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  /**
   * Envía un mensaje de texto formateado con Markdown/HTML y teclado opcional
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>
  ) {
    if (!this.botToken) {
      console.warn('TELEGRAM_BOT_TOKEN no configurado en variables de entorno.');
      return { success: false, reason: 'Token no configurado' };
    }

    const cleanText = cleanAndFormatAIText(text);
    const chunks = splitTelegramChunks(cleanText);

    let lastResult: any = { success: true };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;

      const payload: any = {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      };

      if (isLast && inlineKeyboard && inlineKeyboard.length > 0) {
        payload.reply_markup = {
          inline_keyboard: inlineKeyboard,
        };
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let data = await res.json();

        // Si falla por caracteres especiales de Markdown, reintentar texto plano limpio
        if (!data.ok) {
          const fallbackRes = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              parse_mode: undefined,
            }),
          });
          data = await fallbackRes.json();
        }

        lastResult = data;
      } catch (err: any) {
        console.error('Error enviando mensaje a Telegram:', err);
        return { success: false, error: err.message };
      }
    }

    return lastResult;
  }

  /**
   * Envía un archivo (HTML, PDF, etc.) como documento descargable a Telegram
   */
  public async sendDocument(
    chatId: number | string,
    fileContent: string,
    fileName: string,
    caption?: string
  ) {
    if (!this.botToken) return { success: false, reason: 'Token no configurado' };

    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' });
      formData.append('document', blob, fileName);
      if (caption) formData.append('caption', caption);

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      return await res.json();
    } catch (err: any) {
      console.error('Error enviando documento a Telegram:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Configura la URL del webhook en los servidores de Telegram
   */
  public async setWebhook(url: string, secretToken?: string) {
    if (!this.botToken) return { success: false, reason: 'Token no configurado' };

    const payload: any = { url };
    if (secretToken) payload.secret_token = secretToken;

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return await res.json();
  }

  /**
   * Envía una alerta crítica a todos los operadores y supervisores activos en Telegram
   */
  public async broadcastAlert(text: string, inlineKeyboard?: any[]): Promise<{ sent: number; total: number }> {
    if (!this.botToken) return { sent: 0, total: 0 };

    const chatIds = new Set<string>();

    try {
      const { getMySqlPool } = await import('./db');
      const pool = getMySqlPool();
      if (pool) {
        // 1. Usuarios en telegram_usuarios_autorizados
        try {
          const [rows1]: any = await pool.execute(
            'SELECT chat_id FROM telegram_usuarios_autorizados WHERE notificaciones_activas = 1'
          );
          if (Array.isArray(rows1)) {
            rows1.forEach((r: any) => chatIds.add(String(r.chat_id)));
          }
        } catch (e) {}

        // 2. Sesiones activas de Telegram
        try {
          const [rows2]: any = await pool.execute(
            "SELECT identificador_origen FROM usuarios_controlt_sesiones WHERE canal = 'TELEGRAM' AND activo = 1"
          );
          if (Array.isArray(rows2)) {
            rows2.forEach((r: any) => chatIds.add(String(r.identificador_origen)));
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Si hay un chat_id configurado explícitamente en variables de entorno o configuración
    if (process.env.TELEGRAM_ALERTS_CHAT_ID) {
      chatIds.add(process.env.TELEGRAM_ALERTS_CHAT_ID);
    }

    let sent = 0;
    const targetList = Array.from(chatIds);
    for (const chatId of targetList) {
      try {
        await this.sendMessage(chatId, text, inlineKeyboard);
        sent++;
      } catch (err: any) {
        console.warn(`Error enviando alerta crítica a Telegram ${chatId}:`, err.message);
      }
    }

    return { sent, total: chatIds.size };
  }
}

export const telegramService = new TelegramService();

