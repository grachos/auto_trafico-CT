# Torre de Control ControlT - Agente Autónomo de Tráfico 🚛🤖

Aplicación web moderna y plataforma de agentes desarrollada en **Next.js 14 + TypeScript + Tailwind CSS**, lista para desplegar en **Vercel**, conectada a **ControlT**, **Telegram Bot**, **Supabase (PostgreSQL)** y con servidor **MCP (Model Context Protocol)** para interactuar con cualquier IA.

---

## 🌟 Módulos y Capacidades

### 1. 🤖 Motor de Agente IA con Texto Libre
- **Chat Conversacional Inteligente:** Permite dar órdenes en lenguaje natural:
  - *"Atiende las alarmas de los viajes a tiempo"*
  - *"Dame el reporte de semáforo ETA"*
  - *"¿Cuáles son las alarmas críticas activas?"*
  - *"Atiende la alarma del viaje 0101226422"*
- **Acciones Reales en ControlT:** Consulta el último evento en la vista de Resumen, determina la novedad correcta (*"En ruta sin novedad alguna"*), redacta la observación y confirma el guardado mediante *AGREGAR NOVEDAD*.

### 2. ✈️ Integración Oficial con Telegram Bot
- **Botón y Menú Interactivo en Telegram:**
  - Envía `/start` para recibir botones rápidos de acción: `⚡ Atender Alarmas a Tiempo`, `📊 Semáforo ETA`, `🚨 Alarmas Críticas`.
  - Recibe órdenes en texto libre desde cualquier chat de Telegram y ejecuta las atenciones en ControlT al instante.
  - Endpoint de webhook listo en `/api/telegram/webhook`.

### 3. 🔌 Servidor MCP (Model Context Protocol) para Cualquier IA
- Permite conectar esta plataforma como herramienta nativa a **Claude Desktop**, **Antigravity**, **Cursor** o agentes autónomos.
- **Herramientas MCP Expuestas:**
  - `controlt_get_eta_summary`: Puntualidad y semáforo ETA de los 161 viajes.
  - `controlt_get_active_alarms`: Alarmas activas clasificadas por prioridad.
  - `controlt_attend_alarm`: Atención y cierre de alarma individual con novedad y comentario.
  - `controlt_batch_attend_on_time`: Atención en lote de todas las llamadas de seguimiento de viajes a tiempo.
- Implementación Stdio en `mcp/server.ts` y endpoint HTTP en `/api/mcp`.

### 4. 🗄️ Base de Datos Persistente (Supabase / PostgreSQL)
- **Script DDL completo en [`database/schema.sql`](database/schema.sql)** con tablas para:
  - `viajes`: Estado y telemetría de viajes.
  - `alarmas`: Cola de eventos y severidades.
  - `atenciones_auditoria`: Registro inmutable de cada acción ejecutada por la IA o los operadores.
  - `reglas_mapeo_novedades`: Matriz dinámica de equivalencias de novedades.
  - `telegram_usuarios_autorizados`: Control de acceso y roles.

### 5. 📊 Reportes Operativos en Tiempo Real
- **Reporte Semáforo ETA:** Conteo en vivo (116 A tiempo, 39 Con retraso, 3 Tolerancia).
- **Reporte de Alarmas por Prioridad:** 2 Críticas (Fuera de ruta), 45 Altas (Llamadas de seguimiento).
- **Matriz de Riesgo:** Segregación inteligente de decisiones (IA vs Humano).
- **Exportación Consolidada a Excel (.xlsx):** Generación de libro completo con un solo clic.

---

## 🚀 Inicio Rápido Local

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar el servidor de desarrollo:
```bash
npm run dev
```

3. Abrir en el navegador: `http://localhost:3000`

---

## ✈️ Configuración del Bot de Telegram

1. Crea tu bot en Telegram hablando con [@BotFather](https://t.me/BotFather) y copia el Token.
2. Agrega el token en tu archivo `.env.local`:
   ```env
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   ```
3. Registra el Webhook de tu aplicación (en Vercel o túnel ngrok):
   ```bash
   curl -F "url=https://tu-proyecto.vercel.app/api/telegram/webhook" https://api.telegram.org/bot<TU_TOKEN>/setWebhook
   ```
4. ¡Listo! Abre tu bot en Telegram, escribe `/start` o pídele *"Atiende las alarmas a tiempo"*.

---

## 🔌 Cómo Conectar el Servidor MCP a Claude Desktop / Antigravity

Agrega la siguiente configuración a tu archivo `claude_desktop_config.json` o configuración de MCP:

```json
{
  "mcpServers": {
    "controlt": {
      "command": "npx",
      "args": ["ts-node", "--esm", "C:/Users/GRAZIANY GOMEZ/OneDrive - DAABON/AA Systems/DEV/Auto_trafico-CT/mcp/server.ts"]
    }
  }
}
```

---

## ☁️ Despliegue en Vercel

1. Sube los cambios a GitHub:
   ```bash
   git push origin main
   ```
2. Entra a [vercel.com](https://vercel.com) e importa el repositorio `auto_trafico-CT`.
3. Configura las variables de entorno en Vercel Settings (Supabase, Telegram, ControlT).
4. Haz clic en **Deploy**. ¡Tu torre de control con IA estará en vivo en menos de 2 minutos!
