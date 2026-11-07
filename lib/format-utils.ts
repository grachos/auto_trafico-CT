/**
 * Utilidades compartidas de formateo y limpieza de texto para el Agente IA,
 * Web Chat y Telegram. Funciona tanto en cliente como en servidor sin dependencias de Node.
 */

/**
 * Convierte cualquier tabla Markdown (| ... |) en tarjetas ejecutivas con emojis y viñetas.
 * Evita tablas desbordadas en celulares, Telegram y pantallas estrechas.
 */
export function cleanAndFormatAIText(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const isSeparator = (l: string) => /^\s*\|?(\s*:?-+:?\s*\|?)+\s*$/.test(l.trim());

  const flushTable = () => {
    if (tableLines.length === 0) return;

    // Filtrar líneas separadoras como |---|---| o |:---|
    const validLines = tableLines.filter(l => !isSeparator(l) && l.trim().length > 0);
    if (validLines.length < 2) {
      result.push(...tableLines);
      tableLines = [];
      return;
    }

    const parseRow = (line: string) => {
      let cells = line.split('|').map(c => c.trim());
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    };

    const headers = parseRow(validLines[0]);
    const rows = validLines.slice(1).map(parseRow);

    const cards = rows.map(row => {
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h.toLowerCase()] = row[idx] || '';
      });

      const findVal = (keywords: string[]) => {
        for (const [k, v] of Object.entries(rowObj)) {
          if (keywords.some(kw => k.includes(kw))) return v;
        }
        return '';
      };

      const placa = findVal(['placa', 'vehiculo', 'vehículo']) || row[1] || row[0];
      const viaje = findVal(['viaje', 'trip', 'nro']) || row[0];
      const conductor = findVal(['conductor', 'driver']);
      const cliente = findVal(['cliente', 'customer', 'empresa']);
      const ubicacion = findVal(['ubicacion', 'ubicación', 'direccion', 'dirección', 'lugar']);
      const velocidad = findVal(['velocidad', 'speed', 'km/h']);
      const estado = findVal(['estado', 'status', 'novedad']);
      const comentario = findVal(['comentario', 'observacion', 'observación', 'detalle']);

      if (placa && (viaje || conductor || ubicacion || estado)) {
        let card = `🚛 **${placa}**${viaje && viaje !== placa ? ` — Viaje \`${viaje}\`` : ''}\n`;
        if (conductor) card += `• **Conductor:** ${conductor}${cliente ? ` | **Cliente:** ${cliente}` : ''}\n`;
        else if (cliente) card += `• **Cliente:** ${cliente}\n`;
        if (ubicacion) card += `• **Ubicación:** ${ubicacion}${velocidad ? ` (${velocidad} km/h)` : ''}\n`;
        if (estado) card += `• **Estado:** ${estado}\n`;
        if (comentario) card += `• **Observación:** ${comentario}\n`;
        return card.trim();
      }

      // Tabla genérica (por ejemplo métricas)
      let genericCard = `🔹 **${row[0] || 'Registro'}**\n`;
      headers.slice(1).forEach((h, i) => {
        if (row[i + 1]) genericCard += `• **${h}:** ${row[i + 1]}\n`;
      });
      return genericCard.trim();
    });

    result.push(cards.join('\n\n'));
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const hasPipes = trimmed.includes('|');
    const isTableLine =
      (trimmed.startsWith('|') && trimmed.endsWith('|')) ||
      (trimmed.startsWith('|') && trimmed.split('|').length >= 3) ||
      isSeparator(trimmed);

    if (isTableLine || (inTable && hasPipes)) {
      inTable = true;
      tableLines.push(line);
    } else {
      if (inTable) {
        flushTable();
        inTable = false;
      }
      result.push(line);
    }
  }

  if (inTable) {
    flushTable();
  }

  let formatted = result.join('\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  return formatted.trim();
}
