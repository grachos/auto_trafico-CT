/**
 * SERVICIO CLIENTE PARA LA API DE CONTROLT
 * Conecta directamente con https://tower-api.controlt.com.co usando el Bearer JWT
 */

const API_BASE_URL = process.env.CONTROLT_API_BASE_URL || process.env.CONTROLT_API_URL || 'https://tower-api.controlt.com.co';
const COMPANY_ID = process.env.CONTROLT_COMPANY_ID || process.env.CONTROLT_ACCOUNT_ID || '616346';
const BEARER_TOKEN = process.env.CONTROLT_BEARER_TOKEN || process.env.CONTROLT_TOKEN || '';

export class ControlTApiClient {
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'id-company': COMPANY_ID,
      'time-zone': '-05:00',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    };
  }

  public isConfigured(): boolean {
    return Boolean(BEARER_TOKEN && BEARER_TOKEN.length > 20);
  }

  /**
   * Obtiene la lista de viajes y telemetría de la vista Resumen
   */
  public async getSummaryTrips() {
    if (!this.isConfigured()) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/Home/resumeForUI`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          pageNumber: 1,
          pageSize: 200,
        }),
      });

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
    if (!this.isConfigured()) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/Home/alarms/attendForUI`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          pageNumber: 1,
          pageSize: 100,
        }),
      });

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
    if (!this.isConfigured()) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/Tracking/addNovelty`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });

      return await res.json();
    } catch (err: any) {
      console.error('Error guardando novedad en ControlT:', err.message);
      return null;
    }
  }
}

export const controltClient = new ControlTApiClient();
