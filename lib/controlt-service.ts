/**
 * SERVICIO CLIENTE PARA LA API DE CONTROLT
 * Con Autenticación Dinámica OAuth y Auto-Renovación de Bearer Token
 */

interface CachedTokenState {
  token: string | null;
  expiresAt: number | null;
  idCompany: string | null;
}

// Singleton en memoria para almacenar el token activo y su fecha de expiración
const tokenCache: CachedTokenState = {
  token: process.env.CONTROLT_BEARER_TOKEN || null,
  expiresAt: null,
  idCompany: process.env.CONTROLT_COMPANY_ID || '616346',
};

export class ControlTApiClient {
  private authUrl = process.env.CONTROLT_AUTH_URL || 'https://app.controlt.com.co/apipublic/api/login/oauth';
  private apiBaseUrl = process.env.CONTROLT_API_BASE_URL || 'https://tower-api.controlt.com.co';
  private username = process.env.CONTROLT_USERNAME || '';
  private password = process.env.CONTROLT_PASSWORD || '';

  /**
   * Decodifica un JWT para extraer la fecha de expiración (exp) y el idCompany
   */
  private decodeJwt(token: string): { expMs: number; idCompany?: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(payloadJson);

      let companyId: string | undefined = undefined;
      if (parsed.infoUser) {
        try {
          const infoUser = typeof parsed.infoUser === 'string' ? JSON.parse(parsed.infoUser) : parsed.infoUser;
          if (infoUser.idCompany) companyId = String(infoUser.idCompany);
        } catch {}
      }

      const expMs = parsed.exp ? parsed.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
      return { expMs, idCompany: companyId };
    } catch (e) {
      return null;
    }
  }

  /**
   * Realiza el login en ControlT y obtiene un nuevo Bearer token
   */
  public async loginOAuth(): Promise<string | null> {
    const user = this.username || process.env.CONTROLT_USERNAME;
    const pass = this.password || process.env.CONTROLT_PASSWORD;

    if (!user || !pass) {
      console.warn('CONTROLT_USERNAME o CONTROLT_PASSWORD no están configurados.');
      return null;
    }

    try {
      console.log(`Iniciando sesión OAuth en ControlT para usuario: ${user}...`);
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: user,
          password: pass,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en login OAuth ControlT (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json();
      
      // ControlT puede devolver el token en data.token, data.jwt, data.accessToken o data directamente
      const rawToken = data.token || data.jwt || data.accessToken || data.data?.token || (typeof data === 'string' ? data : null);

      if (!rawToken) {
        console.error('Respuesta de login ControlT no contiene token reconocible:', data);
        return null;
      }

      const decoded = this.decodeJwt(rawToken);
      tokenCache.token = rawToken;
      tokenCache.expiresAt = decoded ? decoded.expMs - 5 * 60 * 1000 : Date.now() + 12 * 60 * 60 * 1000; // 5 min de margen
      if (decoded?.idCompany) {
        tokenCache.idCompany = decoded.idCompany;
      }

      console.log(`✅ Token renovado exitosamente. Expira en: ${new Date(tokenCache.expiresAt).toLocaleTimeString()}`);
      return rawToken;
    } catch (err: any) {
      console.error('Error crítico conectando con el servicio de login OAuth de ControlT:', err.message);
      return null;
    }
  }

  /**
   * Devuelve un Bearer token garantizado y vigente. Si expiró, se auto-renueva.
   */
  public async getValidToken(): Promise<string | null> {
    const now = Date.now();

    // 1. Si hay un token en caché y aún no expira, usarlo
    if (tokenCache.token && (!tokenCache.expiresAt || tokenCache.expiresAt > now)) {
      return tokenCache.token;
    }

    // 2. Si hay token estático en env sin user/pass, inicializar expiración desde el JWT
    if (process.env.CONTROLT_BEARER_TOKEN && !tokenCache.expiresAt) {
      const decoded = this.decodeJwt(process.env.CONTROLT_BEARER_TOKEN);
      if (decoded && decoded.expMs > now) {
        tokenCache.token = process.env.CONTROLT_BEARER_TOKEN;
        tokenCache.expiresAt = decoded.expMs - 5 * 60 * 1000;
        if (decoded.idCompany) tokenCache.idCompany = decoded.idCompany;
        return tokenCache.token;
      }
    }

    // 3. Renovar dinámicamente mediante OAuth
    const oauthToken = await this.loginOAuth();
    if (oauthToken) return oauthToken;

    // 4. Si el login OAuth falla pero existe CONTROLT_BEARER_TOKEN en env, usarlo como respaldo
    if (process.env.CONTROLT_BEARER_TOKEN) {
      console.log('Usando CONTROLT_BEARER_TOKEN de variables de entorno como respaldo.');
      tokenCache.token = process.env.CONTROLT_BEARER_TOKEN;
      return tokenCache.token;
    }

    return null;
  }

  public isConfigured(): boolean {
    return Boolean(
      (process.env.CONTROLT_USERNAME && process.env.CONTROLT_PASSWORD) ||
      process.env.CONTROLT_BEARER_TOKEN
    );
  }

  /**
   * Genera los encabezados HTTP necesarios incluyendo el Bearer token vigente
   */
  private async getHeaders(): Promise<Record<string, string> | null> {
    const token = await this.getValidToken();
    if (!token) return null;

    const companyId = process.env.CONTROLT_COMPANY_ID || tokenCache.idCompany || '616346';

    return {
      'Authorization': `Bearer ${token}`,
      'id-company': companyId,
      'time-zone': '-05:00',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    };
  }

  /**
   * Obtiene la lista de viajes y telemetría de la vista Resumen
   */
  public async getSummaryTrips() {
    let headers = await this.getHeaders();
    if (!headers) return null;

    try {
      let res = await fetch(`${this.apiBaseUrl}/Home/resumeForUI`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pageNumber: 1, pageSize: 200 }),
      });

      // Si da 401 Unauthorized, invalidar token y reintentar login una vez
      if (res.status === 401) {
        console.warn('ControlT devolvió 401 Unauthorized. Forzando renovación de token...');
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${this.apiBaseUrl}/Home/resumeForUI`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pageNumber: 1, pageSize: 200 }),
        });
      }

      if (!res.ok) {
        console.warn(`ControlT API resumeForUI status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('Error consultando ControlT resumeForUI:', err.message);
      return null;
    }
  }

  /**
   * Obtiene la lista de alarmas activas por atender
   */
  public async getAlarmsToAttend() {
    let headers = await this.getHeaders();
    if (!headers) return null;

    try {
      let res = await fetch(`${this.apiBaseUrl}/Home/alarms/attendForUI`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pageNumber: 1, pageSize: 100 }),
      });

      if (res.status === 401) {
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${this.apiBaseUrl}/Home/alarms/attendForUI`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pageNumber: 1, pageSize: 100 }),
        });
      }

      if (!res.ok) {
        console.warn(`ControlT API attendForUI status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('Error consultando ControlT attendForUI:', err.message);
      return null;
    }
  }

  /**
   * Atiende una alarma registrando la novedad en ControlT
   */
  public async attendAlarm(params: {
    idAlarm: string | number;
    idNoveltyType: number;
    description: string;
  }) {
    let headers = await this.getHeaders();
    if (!headers) return null;

    try {
      let res = await fetch(`${this.apiBaseUrl}/Tracking/addNovelty`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (res.status === 401) {
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${this.apiBaseUrl}/Tracking/addNovelty`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });
      }

      return await res.json();
    } catch (err: any) {
      console.error('Error guardando novedad en ControlT:', err.message);
      return null;
    }
  }
}

export const controltClient = new ControlTApiClient();
