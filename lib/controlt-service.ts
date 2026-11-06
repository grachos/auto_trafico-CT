/**
 * SERVICIO CLIENTE PARA LA API DE CONTROLT
 * Implementación validada contra Postman (Colección Control T -> POST Auth)
 */

interface CachedTokenState {
  token: string | null;
  expiresAt: number | null;
  idCompany: string;
  lastError: string | null;
}

const tokenCache: CachedTokenState = {
  token: process.env.CONTROLT_BEARER_TOKEN || null,
  expiresAt: null,
  idCompany: process.env.CONTROLT_COMPANY_ID || '616346',
  lastError: null,
};

export class ControlTApiClient {
  private getAuthUrl(): string {
    return process.env.CONTROLT_AUTH_URL || 'https://app.controlt.com.co/apipublic/api/login/oauth';
  }

  private getApiBaseUrl(): string {
    return process.env.CONTROLT_API_BASE_URL || 'https://tower-api.controlt.com.co';
  }

  private getUsername(): string {
    return (
      process.env.CONTROLT_USERNAME ||
      process.env.CONTROLT_USER ||
      process.env.CONTROLT_EMAIL ||
      ''
    ).trim();
  }

  private getPassword(): string {
    return (
      process.env.CONTROLT_PASSWORD ||
      process.env.CONTROLT_PASS ||
      ''
    ).trim();
  }

  public isConfigured(): boolean {
    const user = this.getUsername();
    const pass = this.getPassword();
    const token = process.env.CONTROLT_BEARER_TOKEN;
    return Boolean((user && pass) || token);
  }

  public getLastError(): string | null {
    return tokenCache.lastError;
  }

  /**
   * Realiza el login en ControlT idéntico a la petición POST de Postman
   */
  public async loginOAuth(): Promise<string | null> {
    const username = this.getUsername();
    const password = this.getPassword();
    const authUrl = this.getAuthUrl();

    if (!username || !password) {
      tokenCache.lastError = 'Faltan CONTROLT_USERNAME o CONTROLT_PASSWORD en las variables de entorno';
      console.warn(tokenCache.lastError);
      return null;
    }

    try {
      console.log(`[ControlT Auth] Conectando a ${authUrl} para usuario: ${username}...`);
      
      const payload = {
        username: username,
        password: password,
      };

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        tokenCache.lastError = `HTTP ${response.status} de ControlT: ${errorBody}`;
        console.error(`[ControlT Auth Error] ${tokenCache.lastError}`);
        return null;
      }

      const json = await response.json();

      // Postman devuelve exactamente: { "access_token": "...", "token_type": "bearer", "expires_in": 102 }
      const accessToken = json.access_token || json.token || json.jwt;

      if (!accessToken) {
        tokenCache.lastError = `Respuesta JSON no contiene access_token: ${JSON.stringify(json)}`;
        console.error(`[ControlT Auth Error] ${tokenCache.lastError}`);
        return null;
      }

      // Guardar en caché y calcular expiración
      const expiresInSec = Number(json.expires_in) || 3600;
      tokenCache.token = accessToken;
      // Renovar 10 segundos antes si expira rápido (ej: 102 seg) o 5 minutos si es de 24h
      const marginMs = expiresInSec > 300 ? 5 * 60 * 1000 : 15 * 1000;
      tokenCache.expiresAt = Date.now() + (expiresInSec * 1000) - marginMs;
      tokenCache.lastError = null;

      console.log(`[ControlT Auth] ✅ Token access_token obtenido exitosamente. Válido por ${expiresInSec}s`);
      return accessToken;
    } catch (err: any) {
      tokenCache.lastError = `Excepción de red conectando con ControlT: ${err.message}`;
      console.error(`[ControlT Auth Error] ${tokenCache.lastError}`);
      return null;
    }
  }

  /**
   * Obtiene un token válido garantizado (o renueva dinámicamente)
   */
  public async getValidToken(): Promise<string | null> {
    const now = Date.now();

    // 1. Si el token en caché está vigente
    if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now) {
      return tokenCache.token;
    }

    // 2. Intentar renovación dinámica vía login OAuth
    const freshToken = await this.loginOAuth();
    if (freshToken) return freshToken;

    // 3. Si OAuth falla pero se proveyó un CONTROLT_BEARER_TOKEN manual en env
    if (process.env.CONTROLT_BEARER_TOKEN) {
      console.log('[ControlT Auth] Usando CONTROLT_BEARER_TOKEN de env como respaldo.');
      tokenCache.token = process.env.CONTROLT_BEARER_TOKEN;
      return tokenCache.token;
    }

    return null;
  }

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

  public async getSummaryTrips() {
    let headers = await this.getHeaders();
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      let res = await fetch(`${apiBase}/Home/resumeForUI`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pageNumber: 1, pageSize: 200 }),
      });

      if (res.status === 401) {
        console.warn('[ControlT] 401 Unauthorized recibido. Re-autenticando...');
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${apiBase}/Home/resumeForUI`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pageNumber: 1, pageSize: 200 }),
        });
      }

      if (!res.ok) {
        console.warn(`[ControlT] resumeForUI status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('[ControlT] Error en getSummaryTrips:', err.message);
      return null;
    }
  }

  public async getAlarmsToAttend() {
    let headers = await this.getHeaders();
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      let res = await fetch(`${apiBase}/Home/alarms/attendForUI`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pageNumber: 1, pageSize: 100 }),
      });

      if (res.status === 401) {
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${apiBase}/Home/alarms/attendForUI`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pageNumber: 1, pageSize: 100 }),
        });
      }

      if (!res.ok) {
        console.warn(`[ControlT] attendForUI status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('[ControlT] Error en getAlarmsToAttend:', err.message);
      return null;
    }
  }

  public async attendAlarm(params: {
    idAlarm: string | number;
    idNoveltyType: number;
    description: string;
  }) {
    let headers = await this.getHeaders();
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      let res = await fetch(`${apiBase}/Tracking/addNovelty`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (res.status === 401) {
        tokenCache.token = null;
        tokenCache.expiresAt = null;
        headers = await this.getHeaders();
        if (!headers) return null;

        res = await fetch(`${apiBase}/Tracking/addNovelty`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });
      }

      return await res.json();
    } catch (err: any) {
      console.error('[ControlT] Error en attendAlarm:', err.message);
      return null;
    }
  }
}

export const controltClient = new ControlTApiClient();
