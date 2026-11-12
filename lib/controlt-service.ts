/**
 * SERVICIO CLIENTE PARA LA API DE CONTROLT
 * Implementación 100% verificada contra Swagger y OpenAPI de tower-api.controlt.com.co
 * Soporta sesiones por usuario con contraseñas cifradas en reposo (AES-256-GCM).
 */

import { decryptPassword } from './mcp-crypto';
import { getMcpCredentials, markMcpUserRequiresReauth } from './mcp-db';

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
  private userTokenCache = new Map<string, { token: string; expiresAt: number; idCompany: string }>();

  private getAuthUrl(): string {
    return (process.env.CONTROLT_AUTH_URL || 'https://app.controlt.com.co/apipublic/api/login/oauth')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  private getApiBaseUrl(): string {
    return (process.env.CONTROLT_API_BASE_URL || 'https://tower-api.controlt.com.co')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  private getUsername(): string {
    return (
      process.env.CONTROLT_USERNAME ||
      process.env.CONTROLT_USER ||
      process.env.CONTROLT_EMAIL ||
      ''
    )
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  private getPassword(): string {
    return (
      process.env.CONTROLT_PASSWORD ||
      process.env.CONTROLT_PASS ||
      ''
    )
      .replace(/^["']|["']$/g, '')
      .trim();
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
   * Valida credenciales de cualquier usuario en tiempo real contra ControlT OAuth
   */
  public async authenticateUser(username: string, password: string): Promise<{
    success: boolean;
    token?: string;
    userName?: string;
    idCompany?: string;
    error?: string;
  }> {
    const cleanUser = username?.trim();
    const cleanPass = password?.trim();
    const authUrl = this.getAuthUrl();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'Usuario y contraseña requeridos' };
    }

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          return { success: false, error: 'Credenciales inválidas en ControlT. Verifica tu usuario y contraseña.' };
        }
        return { success: false, error: `Error de servidor ControlT (HTTP ${response.status})` };
      }

      const json = await response.json();
      const accessToken = json.access_token || json.token || json.jwt;

      if (!accessToken) {
        return { success: false, error: 'Respuesta de ControlT no contiene token de acceso válido' };
      }

      return {
        success: true,
        token: accessToken,
        userName: json.userName || json.name || cleanUser,
        idCompany: String(json.idCompany || '616346'),
      };
    } catch (err: any) {
      console.error('Error autenticando usuario en ControlT:', err);
      return { success: false, error: `Error de conexión con ControlT: ${err.message}` };
    }
  }

  /**
   * Realiza el login OAuth (idéntico a Postman) con credenciales globales de admin
   */
  public async loginOAuth(): Promise<string | null> {
    const username = this.getUsername();
    const password = this.getPassword();
    const authUrl = this.getAuthUrl();

    if (!username || !password) {
      tokenCache.lastError = 'Faltan CONTROLT_USERNAME o CONTROLT_PASSWORD en las variables de entorno';
      return null;
    }

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        tokenCache.lastError = `HTTP ${response.status} de ControlT: ${errorBody}`;
        return null;
      }

      const json = await response.json();
      const accessToken = json.access_token || json.token || json.jwt;

      if (!accessToken) {
        tokenCache.lastError = `Respuesta JSON no contiene access_token: ${JSON.stringify(json)}`;
        return null;
      }

      const expiresInSec = Number(json.expires_in) || 3600;
      tokenCache.token = accessToken;
      const marginMs = expiresInSec > 300 ? 5 * 60 * 1000 : 15 * 1000;
      tokenCache.expiresAt = Date.now() + (expiresInSec * 1000) - marginMs;
      tokenCache.lastError = null;

      return accessToken;
    } catch (err: any) {
      tokenCache.lastError = `Excepción de red: ${err.message}`;
      return null;
    }
  }

  public async getValidToken(): Promise<string | null> {
    const now = Date.now();

    if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now) {
      return tokenCache.token;
    }

    const freshToken = await this.loginOAuth();
    if (freshToken) return freshToken;

    if (process.env.CONTROLT_BEARER_TOKEN) {
      tokenCache.token = process.env.CONTROLT_BEARER_TOKEN;
      return tokenCache.token;
    }

    return null;
  }

  /**
   * Obtiene un token válido para un usuario específico, descifrando su contraseña en memoria si es necesario.
   * Si no se especifica usuario o es 'admin', utiliza la sesión global.
   */
  public async getValidTokenForUser(username?: string): Promise<{
    token: string | null;
    idCompany: string;
    error?: string;
  }> {
    const cleanUser = username?.trim().toLowerCase();

    // Si no hay usuario especificado o es 'admin', usar credenciales globales
    if (!cleanUser || cleanUser === 'admin') {
      const globalToken = await this.getValidToken();
      const companyId = (process.env.CONTROLT_COMPANY_ID || tokenCache.idCompany || '616346')
        .replace(/^["']|["']$/g, '')
        .trim();
      return {
        token: globalToken,
        idCompany: companyId,
        error: globalToken ? undefined : tokenCache.lastError || 'GLOBAL_AUTH_FAILED',
      };
    }

    const now = Date.now();
    const cached = this.userTokenCache.get(cleanUser);
    if (cached && cached.expiresAt > now) {
      return { token: cached.token, idCompany: cached.idCompany };
    }

    // Buscar credenciales cifradas en BD
    const creds = await getMcpCredentials(cleanUser);
    if (!creds) {
      // Fallback a global si el usuario no tiene credenciales MCP individuales configuradas
      const globalToken = await this.getValidToken();
      const companyId = (process.env.CONTROLT_COMPANY_ID || tokenCache.idCompany || '616346')
        .replace(/^["']|["']$/g, '')
        .trim();
      return {
        token: globalToken,
        idCompany: companyId,
        error: globalToken ? undefined : 'USER_CREDENTIALS_NOT_FOUND',
      };
    }

    if (creds.requiereReauth) {
      return { token: null, idCompany: '616346', error: 'USER_REAUTH_REQUIRED' };
    }

    // Descifrado en memoria efímera
    let plainPassword = '';
    try {
      plainPassword = decryptPassword(creds.encryptedPassword, creds.iv, creds.authTag, cleanUser);
    } catch (err: any) {
      console.error('[ControlT] Error descifrando credencial de usuario');
      return { token: null, idCompany: '616346', error: 'DECRYPTION_FAILED' };
    }

    const authResult = await this.authenticateUser(cleanUser, plainPassword);
    if (!authResult.success || !authResult.token) {
      if (authResult.error?.includes('Credenciales inválidas') || authResult.error?.includes('401')) {
        await markMcpUserRequiresReauth(cleanUser);
      }
      return { token: null, idCompany: '616346', error: authResult.error || 'AUTH_REJECTED' };
    }

    const idCompany = authResult.idCompany || '616346';
    const expiresAt = now + 50 * 60 * 1000; // 50 minutos de validez
    this.userTokenCache.set(cleanUser, {
      token: authResult.token,
      expiresAt,
      idCompany,
    });

    return { token: authResult.token, idCompany };
  }

  public async getHeaders(username?: string): Promise<Record<string, string> | null> {
    const auth = await this.getValidTokenForUser(username);
    if (!auth.token) return null;

    return {
      'Authorization': `Bearer ${auth.token}`,
      'id-company': auth.idCompany,
      'time-zone': '-05:00',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    };
  }

  /**
   * Obtiene la lista de viajes (GET /Home/resumeForUI?search=&size=200&page=1)
   */
  public async getSummaryTrips(size: number = 200, page: number = 1, username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      const url = `${apiBase}/Home/resumeForUI?search=&size=${size}&page=${page}`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
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

  /**
   * Obtiene la cola de alarmas por atender (GET /Home/alarms/attendForUI?search=&size=100&page=1)
   */
  public async getAlarmsToAttend(size: number = 100, page: number = 1, username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      const url = `${apiBase}/Home/alarms/attendForUI?search=&size=${size}&page=${page}`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
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

  /**
   * Atiende una alarma en ControlT (POST /Alarms/attend/Save/Novelty)
   */
  public async attendAlarm(params: {
    idMonitoringOrdersAlarm?: number | string;
    idAlarm?: number | string;
    numberTrip?: string;
    tripNumber?: string;
    licensePlate?: string;
    vehiclePlate?: string;
    noveltySelected?: number;
    idNoveltyType?: number;
    codeNoveltySelected?: string;
    comment?: string;
    description?: string;
    address?: string;
    username?: string;
  }) {
    let headers = await this.getHeaders(params.username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();
    const companyId = Number(
      (process.env.CONTROLT_COMPANY_ID || tokenCache.idCompany || '616346')
        .replace(/^["']|["']$/g, '')
        .trim()
    );
    const operationalUser = params.username || this.getUsername() || 'ggomez@elogia.com.co';

    const alarmId = params.idMonitoringOrdersAlarm || params.idAlarm;
    const numberTrip = params.numberTrip || params.tripNumber || '';
    const licensePlate = params.licensePlate || params.vehiclePlate || '';
    const noveltySelected = params.noveltySelected || params.idNoveltyType || 1;
    const comment = params.comment || params.description || 'En ruta sin novedad alguna';

    const payload = {
      idMonitoringOrdersAlarm: Number(alarmId),
      numberTrip,
      licensePlate,
      noveltySelected,
      codeNoveltySelected: params.codeNoveltySelected || 'EN_RUTA',
      comment,
      address: params.address || 'En ruta',
      username: operationalUser,
      idCompany: companyId,
      timeZone: '-05:00',
    };

    try {
      const url = `${apiBase}/Alarms/attend/Save/Novelty`;
      let res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        if (params.username) this.userTokenCache.delete(params.username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(params.username);
        if (!headers) return null;
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      return await res.json();
    } catch (err: any) {
      console.error('[ControlT] Error en attendAlarm:', err.message);
      return null;
    }
  }

  /**
   * API HUB: Obtiene la posición GPS actual de un vehículo por placa (GET /Hub/CurrentPosition/{licensePlate})
   */
  public async getCurrentPosition(licensePlate: string, username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();
    const cleanPlate = encodeURIComponent(licensePlate.trim().toUpperCase());

    try {
      const url = `${apiBase}/Hub/CurrentPosition/${cleanPlate}`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
      }

      if (!res.ok) {
        console.warn(`[ControlT] Hub CurrentPosition status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error(`[ControlT] Error en getCurrentPosition(${licensePlate}):`, err.message);
      return null;
    }
  }

  /**
   * API Alarmas Atendidas: Histórico de alarmas atendidas (GET /Home/alarmsForUI?search=&size=50&page=1)
   */
  public async getAttendedAlarms(size: number = 50, page: number = 1, search: string = '', username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      const url = `${apiBase}/Home/alarmsForUI?search=${encodeURIComponent(search)}&size=${size}&page=${page}`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
      }

      if (!res.ok) {
        console.warn(`[ControlT] alarmsForUI status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('[ControlT] Error en getAttendedAlarms:', err.message);
      return null;
    }
  }

  /**
   * API Binnacle: Bitácora completa de eventos y novedades de un viaje (GET /Binnacle/{idMonitoringOrder})
   */
  public async getTripBinnacle(idMonitoringOrder: string | number, size: number = 50, page: number = 1, username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      const url = `${apiBase}/Binnacle/${idMonitoringOrder}?size=${size}&page=${page}&alarms=true&events=true`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
      }

      if (!res.ok) {
        console.warn(`[ControlT] Binnacle status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error(`[ControlT] Error en getTripBinnacle(${idMonitoringOrder}):`, err.message);
      return null;
    }
  }

  /**
   * API Novedades por Alarma: Catálogo de novedades disponibles para una alarma específica
   * (GET /Alarms/attend/NoveltiesByAlarm/{idMonitoringOrderAlarm})
   */
  public async getNoveltiesByAlarm(idMonitoringOrderAlarm: string | number, username?: string) {
    let headers = await this.getHeaders(username);
    if (!headers) return null;

    const apiBase = this.getApiBaseUrl();

    try {
      const url = `${apiBase}/Alarms/attend/NoveltiesByAlarm/${idMonitoringOrderAlarm}?search=&size=50&page=1`;
      let res = await fetch(url, { method: 'GET', headers });

      if (res.status === 401) {
        if (username) this.userTokenCache.delete(username.trim().toLowerCase());
        else {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }
        headers = await this.getHeaders(username);
        if (!headers) return null;
        res = await fetch(url, { method: 'GET', headers });
      }

      if (!res.ok) {
        console.warn(`[ControlT] NoveltiesByAlarm status: ${res.status}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error(`[ControlT] Error en getNoveltiesByAlarm(${idMonitoringOrderAlarm}):`, err.message);
      return null;
    }
  }
}

export const controltClient = new ControlTApiClient();
