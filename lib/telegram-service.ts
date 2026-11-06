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

    const payload: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    };

    if (inlineKeyboard && inlineKeyboard.length > 0) {
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

      return data;
    } catch (err: any) {
      console.error('Error enviando mensaje a Telegram:', err);
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
}

export const telegramService = new TelegramService();

