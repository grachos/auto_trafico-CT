import { getMySqlPool } from './db';
import { dataStore } from './data-store';

export interface ReportVehicle {
  nro_viaje: string;
  placa: string;
  conductor: string;
  telefono?: string;
  cliente: string;
  origen: string;
  destino: string;
  semaforo_eta: string;
  porcentaje_ruta?: number;
  velocidad_kmh: number;
  ubicacion: string;
  ultimo_evento: string;
}

/**
 * Consulta todos los vehículos que coincidan con la búsqueda directamente de MySQL o dataStore
 */
export async function getVehiclesForReport(
  busqueda: string = '',
  filtroSemaforo: string = 'TODOS',
  filtroVelocidad: 'TODOS' | 'EN_MOVIMIENTO' | 'DETENIDO' = 'TODOS',
  minPorcentajeAvance?: number,
  maxPorcentajeAvance?: number
): Promise<ReportVehicle[]> {
  const pool = getMySqlPool();
  const q = busqueda.trim().toLowerCase();

  if (pool) {
    try {
      let sql = `SELECT nro_viaje, placa, conductor, telefono, cliente, origen, destino, semaforo_eta, porcentaje_ruta, velocidad_kmh, ubicacion, ultimo_evento 
                 FROM viajes WHERE 1=1`;
      const params: any[] = [];

      if (filtroSemaforo !== 'TODOS') {
        sql += ` AND semaforo_eta = ?`;
        params.push(filtroSemaforo);
      }

      if (filtroVelocidad === 'EN_MOVIMIENTO') {
        sql += ` AND velocidad_kmh > 0`;
      } else if (filtroVelocidad === 'DETENIDO') {
        sql += ` AND (velocidad_kmh = 0 OR velocidad_kmh IS NULL)`;
      }

      if (minPorcentajeAvance !== undefined && !isNaN(minPorcentajeAvance)) {
        sql += ` AND porcentaje_ruta >= ?`;
        params.push(minPorcentajeAvance);
      }

      if (maxPorcentajeAvance !== undefined && !isNaN(maxPorcentajeAvance)) {
        sql += ` AND porcentaje_ruta <= ?`;
        params.push(maxPorcentajeAvance);
      }

      if (q) {
        sql += ` AND (LOWER(placa) LIKE ? OR LOWER(conductor) LIKE ? OR LOWER(nro_viaje) LIKE ? OR LOWER(cliente) LIKE ? OR LOWER(destino) LIKE ?)`;
        const term = `%${q}%`;
        params.push(term, term, term, term, term);
      }

      sql += filtroVelocidad === 'EN_MOVIMIENTO' 
        ? ` ORDER BY velocidad_kmh DESC LIMIT 500` 
        : ` ORDER BY nro_viaje DESC LIMIT 500`;

      const [rows]: any = await pool.execute(sql, params);
      return rows as ReportVehicle[];
    } catch (e: any) {
      console.warn('Error consultando viajes en MySQL para reporte:', e.message);
    }
  }

  // Fallback a dataStore local
  let local = dataStore.getViajes(filtroSemaforo as any);
  if (filtroVelocidad === 'EN_MOVIMIENTO') {
    local = local.filter(v => (v.velocidadKmh || 0) > 0);
  } else if (filtroVelocidad === 'DETENIDO') {
    local = local.filter(v => (v.velocidadKmh || 0) === 0);
  }

  if (minPorcentajeAvance !== undefined && !isNaN(minPorcentajeAvance)) {
    local = local.filter(v => (v.porcentajeRuta || 0) >= minPorcentajeAvance);
  }
  if (maxPorcentajeAvance !== undefined && !isNaN(maxPorcentajeAvance)) {
    local = local.filter(v => (v.porcentajeRuta || 0) <= maxPorcentajeAvance);
  }

  if (q) {
    local = local.filter(v =>
      v.placa.toLowerCase().includes(q) ||
      v.conductor.toLowerCase().includes(q) ||
      v.nroViaje.includes(q) ||
      (v.cliente && v.cliente.toLowerCase().includes(q))
    );
  }

  return local.map(v => ({
    nro_viaje: v.nroViaje,
    placa: v.placa,
    conductor: v.conductor,
    telefono: v.telefono,
    cliente: v.cliente,
    origen: v.origen,
    destino: v.destino,
    semaforo_eta: v.semaforoETA,
    porcentaje_ruta: v.porcentajeRuta,
    velocidad_kmh: v.velocidadKmh,
    ubicacion: v.ubicacion,
    ultimo_evento: v.ultimoEvento,
  }));
}

/**
 * Genera el documento HTML completo, responsivo y listo para imprimir en PDF
 */
export function buildHtmlReport(vehicles: ReportVehicle[], title: string = 'Reporte Ejecutivo de Flota'): string {
  const total = vehicles.length;
  const aTiempo = vehicles.filter(v => v.semaforo_eta === 'A_TIEMPO').length;
  const tarde = vehicles.filter(v => v.semaforo_eta === 'TARDE').length;
  const tolerancia = vehicles.filter(v => v.semaforo_eta === 'TOLERANCIA').length;
  const sinCalculo = total - aTiempo - tarde - tolerancia;

  const fechaGeneracion = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const rowsHtml = vehicles.map((v, i) => {
    let etaBadge = '<span class="badge badge-green">🟢 A Tiempo</span>';
    if (v.semaforo_eta === 'TARDE') {
      etaBadge = '<span class="badge badge-red">🔴 Retrasado</span>';
    } else if (v.semaforo_eta === 'TOLERANCIA') {
      etaBadge = '<span class="badge badge-yellow">🟡 Tolerancia</span>';
    } else if (v.semaforo_eta === 'SIN_CALCULO') {
      etaBadge = '<span class="badge badge-gray">⚪ Sin Cálculo</span>';
    }

    const speed = Number(v.velocidad_kmh || 0);
    const speedBadge = speed > 0
      ? `<span class="badge badge-blue">⚡ ${speed} km/h</span>`
      : `<span class="badge badge-gray">⏸️ 0 km/h</span>`;

    return `
      <tr>
        <td class="text-center font-bold text-gray-500">${i + 1}</td>
        <td><strong class="plate-badge">${v.placa}</strong></td>
        <td class="font-mono text-xs">${v.nro_viaje}</td>
        <td>
          <div class="font-semibold text-gray-900">${v.conductor}</div>
          ${v.telefono ? `<div class="text-xs text-gray-500">📞 ${v.telefono}</div>` : ''}
        </td>
        <td class="text-xs text-gray-700 font-medium">${v.cliente}</td>
        <td class="text-xs text-gray-600">
          <div><span class="text-gray-400">Orig:</span> ${v.origen || 'N/A'}</div>
          <div><span class="text-gray-400">Dest:</span> ${v.destino || 'N/A'}</div>
        </td>
        <td class="text-xs text-gray-700 max-w-xs">${v.ubicacion || 'En ruta'}</td>
        <td class="text-center">${speedBadge}</td>
        <td class="text-center font-bold text-xs text-gray-700">${v.porcentaje_ruta !== undefined && v.porcentaje_ruta !== null ? `${v.porcentaje_ruta}%` : 'N/A'}</td>
        <td class="text-center">${etaBadge}</td>
        <td class="text-xs text-gray-600 max-w-xs">${v.ultimo_evento || 'Sin novedad'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Torre de Control Inteligente Elogia (ToCIE)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    :root {
      --primary: #263028;
      --accent: #5F7663;
      --bg: #F7F9F7;
      --card-bg: #ffffff;
      --border: #D2DFD4;
      --text: #263028;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .header {
      background: #263028;
      color: white;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 2px solid #5F7663;
    }
    .header h1 {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header p {
      font-size: 12px;
      color: #A8BFAB;
      margin-top: 4px;
    }
    .actions-bar {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .btn-primary { background: #5F7663; color: white; }
    .btn-primary:hover { background: #4B5E4F; }
    .btn-emerald { background: #059669; color: white; }
    .btn-emerald:hover { background: #047857; }
    .btn-secondary { background: rgba(255, 255, 255, 0.15); color: white; }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.25); }

    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 16px 32px;
      background: #F0F4F1;
      border-bottom: 1px solid var(--border);
    }
    .metric-card {
      background: white;
      padding: 14px 18px;
      border-radius: 12px;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .metric-card .label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .metric-card .value { font-size: 22px; font-weight: 700; margin-top: 2px; }

    .search-box-bar {
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid var(--border);
    }
    .search-input {
      padding: 10px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      width: 100%;
      max-width: 400px;
      font-size: 13px;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }

    .table-responsive {
      overflow-x: auto;
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: #f8fafc;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tr:hover { background: #f8fafc; }

    .plate-badge {
      display: inline-block;
      background: #fef08a;
      color: #854d0e;
      border: 1px solid #fde047;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
    .badge-blue { background: #e0e7ff; color: #3730a3; }
    .badge-gray { background: #f1f5f9; color: #475569; }

    .footer {
      padding: 16px 32px;
      font-size: 12px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
      border-top: 1px solid var(--border);
    }

    @media print {
      body { padding: 0; background: white; }
      .container { box-shadow: none; border: none; max-width: 100%; }
      .actions-bar, .search-box-bar { display: none !important; }
      th, td { padding: 8px 10px; font-size: 10px; }
      .plate-badge { font-size: 10px; padding: 1px 4px; }
      .badge { font-size: 9px; padding: 1px 5px; }
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="header">
      <div>
        <h1>🚛 ${title}</h1>
        <p>ControlT — Sistema Autónomo de Tráfico | Emitido: ${fechaGeneracion}</p>
      </div>
      <div class="actions-bar">
        <button onclick="window.print()" class="btn btn-secondary">
          🖨️ Imprimir / Guardar PDF
        </button>
        <button onclick="exportTableToExcel()" class="btn btn-emerald">
          📊 Descargar Excel (.xlsx)
        </button>
      </div>
    </div>

    <div class="metrics-bar">
      <div class="metric-card">
        <span class="label">Total Vehículos</span>
        <span class="value" style="color: #1e293b;">${total}</span>
      </div>
      <div class="metric-card">
        <span class="label">🟢 A Tiempo</span>
        <span class="value" style="color: #16a34a;">${aTiempo}</span>
      </div>
      <div class="metric-card">
        <span class="label">🔴 Retrasados / Tarde</span>
        <span class="value" style="color: #dc2626;">${tarde}</span>
      </div>
      <div class="metric-card">
        <span class="label">🟡 En Tolerancia</span>
        <span class="value" style="color: #ca8a04;">${tolerancia}</span>
      </div>
    </div>

    <div class="search-box-bar">
      <input type="text" id="filterInput" class="search-input" placeholder="🔍 Filtrar en vivo por placa, conductor, ciudad, viaje..." onkeyup="filterTable()">
      <span id="matchCounter" style="font-size: 12px; color: #64748b; font-weight: 600;">Mostrando ${total} de ${total} registros</span>
    </div>

    <div class="table-responsive">
      <table id="fleetTable">
        <thead>
          <tr>
            <th class="text-center">#</th>
            <th>Placa</th>
            <th>Nro. Viaje</th>
            <th>Conductor</th>
            <th>Cliente</th>
            <th>Ruta (Origen / Destino)</th>
            <th>Ubicación Actual</th>
            <th class="text-center">Velocidad</th>
            <th class="text-center">% Avance</th>
            <th class="text-center">Semáforo ETA</th>
            <th>Última Novedad</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <span>Torre de Control ControlT &bull; Integración Omnicanal Web & Telegram</span>
      <span>Generado automáticamente sin consumo de tokens de IA</span>
    </div>
  </div>

  <script>
    function filterTable() {
      const input = document.getElementById('filterInput').value.toLowerCase();
      const rows = document.querySelectorAll('#fleetTable tbody tr');
      let visible = 0;

      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(input)) {
          row.style.display = '';
          visible++;
        } else {
          row.style.display = 'none';
        }
      });

      document.getElementById('matchCounter').innerText = 'Mostrando ' + visible + ' de ' + rows.length + ' registros';
    }

    function exportTableToExcel() {
      const table = document.getElementById('fleetTable');
      const wb = XLSX.utils.table_to_book(table, { sheet: "Flota_Vehiculos" });
      const filename = "${title.replace(/[^a-zA-Z0-9]/g, '_')}_" + new Date().toISOString().slice(0, 10) + ".xlsx";
      XLSX.writeFile(wb, filename);
    }
  </script>
</body>
</html>`;
}

/**
 * Consulta de paginación directa a base de datos (0 TOKENS de IA)
 * Formatea directamente las tarjetas sin pasar por OpenAI ni gastar cuota de API.
 */
export async function getVehiclesPaginatedDirect(
  busqueda: string = '',
  pagina: number = 1,
  limite: number = 5,
  filtroSemaforo: string = 'TODOS',
  filtroVelocidad: 'TODOS' | 'EN_MOVIMIENTO' | 'DETENIDO' = 'TODOS',
  minPorcentajeAvance?: number,
  maxPorcentajeAvance?: number
): Promise<{ text: string; actionTaken: any }> {
  const pool = getMySqlPool();
  const q = busqueda.trim().toLowerCase();
  const safePage = Math.max(1, pagina);
  const safeLimit = Math.min(10, Math.max(1, limite));
  const offset = (safePage - 1) * safeLimit;

  let total = 0;
  let rows: ReportVehicle[] = [];

  if (pool) {
    try {
      let whereClause = ` WHERE 1=1`;
      const params: any[] = [];

      if (filtroSemaforo !== 'TODOS') {
        whereClause += ` AND semaforo_eta = ?`;
        params.push(filtroSemaforo);
      }

      if (filtroVelocidad === 'EN_MOVIMIENTO') {
        whereClause += ` AND velocidad_kmh > 0`;
      } else if (filtroVelocidad === 'DETENIDO') {
        whereClause += ` AND (velocidad_kmh = 0 OR velocidad_kmh IS NULL)`;
      }

      if (minPorcentajeAvance !== undefined && !isNaN(minPorcentajeAvance)) {
        whereClause += ` AND porcentaje_ruta >= ?`;
        params.push(minPorcentajeAvance);
      }

      if (maxPorcentajeAvance !== undefined && !isNaN(maxPorcentajeAvance)) {
        whereClause += ` AND porcentaje_ruta <= ?`;
        params.push(maxPorcentajeAvance);
      }

      if (q) {
        whereClause += ` AND (LOWER(placa) LIKE ? OR LOWER(conductor) LIKE ? OR LOWER(nro_viaje) LIKE ? OR LOWER(cliente) LIKE ? OR LOWER(destino) LIKE ?)`;
        const term = `%${q}%`;
        params.push(term, term, term, term, term);
      }

      const [countRows]: any = await pool.execute(`SELECT COUNT(*) as total FROM viajes ${whereClause}`, params);
      total = Number(countRows[0]?.total || 0);

      const orderSql = filtroVelocidad === 'EN_MOVIMIENTO'
        ? `ORDER BY velocidad_kmh DESC`
        : `ORDER BY nro_viaje DESC`;

      const [dbRows]: any = await pool.execute(
        `SELECT nro_viaje, placa, conductor, telefono, cliente, origen, destino, semaforo_eta, porcentaje_ruta, velocidad_kmh, ubicacion, ultimo_evento 
         FROM viajes ${whereClause} 
         ${orderSql} 
         LIMIT ${safeLimit} OFFSET ${offset}`,
        params
      );
      rows = dbRows;
    } catch (e: any) {
      console.warn('Error en paginación directa MySQL:', e.message);
    }
  }

  if (rows.length === 0 && total === 0) {
    let local = dataStore.getViajes(filtroSemaforo as any);
    if (filtroVelocidad === 'EN_MOVIMIENTO') {
      local = local.filter(v => (v.velocidadKmh || 0) > 0);
    } else if (filtroVelocidad === 'DETENIDO') {
      local = local.filter(v => (v.velocidadKmh || 0) === 0);
    }

    if (minPorcentajeAvance !== undefined && !isNaN(minPorcentajeAvance)) {
      local = local.filter(v => (v.porcentajeRuta || 0) >= minPorcentajeAvance);
    }
    if (maxPorcentajeAvance !== undefined && !isNaN(maxPorcentajeAvance)) {
      local = local.filter(v => (v.porcentajeRuta || 0) <= maxPorcentajeAvance);
    }

    if (q) {
      local = local.filter(v =>
        v.placa.toLowerCase().includes(q) ||
        v.conductor.toLowerCase().includes(q) ||
        v.nroViaje.includes(q) ||
        (v.cliente && v.cliente.toLowerCase().includes(q))
      );
    }
    total = local.length;
    rows = local.slice(offset, offset + safeLimit).map(v => ({
      nro_viaje: v.nroViaje,
      placa: v.placa,
      conductor: v.conductor,
      telefono: v.telefono,
      cliente: v.cliente,
      origen: v.origen,
      destino: v.destino,
      semaforo_eta: v.semaforoETA,
      porcentaje_ruta: v.porcentajeRuta,
      velocidad_kmh: v.velocidadKmh,
      ubicacion: v.ubicacion,
      ultimo_evento: v.ultimoEvento,
    }));
  }

  if (rows.length === 0) {
    return {
      text: `🔍 No se encontraron vehículos activos que coincidan con los criterios seleccionados.`,
      actionTaken: undefined,
    };
  }

  const totalPaginas = Math.max(1, Math.ceil(total / safeLimit));
  const hayMas = safePage < totalPaginas;

  const cards = rows.map(v => {
    let novelty = 'En ruta sin novedad alguna';
    if (v.semaforo_eta === 'TARDE') novelty = 'Retrasado / Tarde';
    else if (v.semaforo_eta === 'TOLERANCIA') novelty = 'En Tolerancia';

    const avanceText = (v.porcentaje_ruta !== undefined && v.porcentaje_ruta !== null)
      ? ` | **Avance:** ${v.porcentaje_ruta}%`
      : '';

    return `🚛 **${v.placa}** — Viaje \`${v.nro_viaje}\`
• **Conductor:** ${v.conductor} | **Cliente:** ${v.cliente}
• **Ubicación:** ${v.ubicacion || 'En tránsito'} (${Number(v.velocidad_kmh || 0)} km/h)${avanceText}
• **Novedad:** *${novelty}*
• **Observación:** ${v.ultimo_evento || 'En ruta normal'}`;
  });

  let text = cards.join('\n\n');

  if (hayMas) {
    text += `\n\n📌 *Mostrando ${rows.length} de ${total} vehículos (Página ${safePage} de ${totalPaginas}). Presiona el botón inferior para ver la siguiente tanda o ver la tabla completa.*`;
  } else {
    text += `\n\n📌 *Has llegado al final de los resultados (${total} vehículos encontrados en total).*`;
  }

  return {
    text,
    actionTaken: {
      type: 'PAGINATION_AVAILABLE',
      summary: `Página ${safePage} de ${totalPaginas} (${total} viajes)`,
      affectedCount: rows.length,
      pagination: {
        busqueda,
        filtroSemaforo,
        filtroVelocidad,
        minPorcentajeAvance,
        maxPorcentajeAvance,
        paginaActual: safePage,
        proximaPagina: hayMas ? safePage + 1 : null,
        total,
        totalPaginas,
      },
    },
  };
}
