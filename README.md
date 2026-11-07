# Torre de Control ControlT - Agente Autónomo de Tráfico 🚛🤖

Plataforma inteligente y torre de control de transporte de carga pesada desarrollada en **Next.js 14 + TypeScript + Tailwind CSS**, desplegada en **Vercel**, conectada en tiempo real a las APIs de **ControlT**, **Telegram Bot**, **WhatsApp / Meta Webhooks**, base de datos **MySQL (Hostinger)** y con servidor **MCP (Model Context Protocol)** para interactuar con cualquier IA externa (Claude Desktop, Cursor, Antigravity, ChatGPT).

---

## 🌟 Módulos y Capacidades

### 1. 🔐 Autenticación Multiusuario con Credenciales de ControlT
- **Pantalla de Inicio de Sesión Previa:** Ningún operador puede ver el tablero sin antes autenticarse con su propio usuario y contraseña de ControlT Tower.
- **Icono de Ojo Interactivo:** Permite ver u ocultar la contraseña con un solo clic (`Eye` / `EyeOff`).
- **Validación en Vivo contra OAuth de ControlT:** Conexión directa a `POST https://app.controlt.com.co/apipublic/api/login/oauth`.
- **Sesiones Seguras en MySQL:** Las sesiones activas se persisten en la tabla `usuarios_controlt_sesiones` con cookies HTTP-only (`ct_session_token`).
- **Variables Administrativas Preservadas:** Las credenciales configuradas en el `.env` de Vercel se mantienen para la ejecución autónoma de tareas programadas en segundo plano (crons).

### 2. 🤖 Motor de Agente IA con Function Calling
- **Modelos Compatibles:** OpenAI (`gpt-4o-mini`) y Google Gemini (`gemini-2.5-flash`), con soporte para fallback determinístico.
- **Function Calling Nativo:** El agente consulta viajes, filtra estados ETA, extrae la posición GPS y atiende alarmas directamente llamando funciones del sistema.
- **Formateo Antirrotura en Tarjetas Ejecutivas:** Toda la información de vehículos se presenta en tarjetas legibles con emojis (`🚛 Placa`, `• Conductor`, `• Ubicación`, etc.), evitando tablas desbordadas o partidas en celulares y Telegram.
- **Paginación Eficiente (5 vehículos por bloque):** Ahorro drástico de tokens con navegación interactiva.

### 3. 📄 Exportación Tabular y Reportes en Pantalla Completa (Cero Tokens)
- **Visualizador HTML / PDF:** Botón directo *"🌐 Ver Tabla Completa / PDF"* en el chat web y en Telegram.
- **Generación Local sin IA:** Consulta directamente MySQL, genera tablas estilizadas con filtros rápidos por semáforo ETA y permite imprimir o descargar en PDF sin consumir tokens de OpenAI/Gemini.

### 4. ✈️ Bot de Telegram con Control de Acceso
- **Compuerta de Seguridad:** Si un operador no está registrado, el bot bloquea el acceso y le solicita:
  ```text
  /login <tu_usuario_controlt> <tu_contraseña>
  ```
- **Botones Interactivos:** Atender alarmas a tiempo en lote, consultar semáforo ETA, ver alarmas críticas y navegar páginas de vehículos.
- **Envío de Documentos:** Descarga de reportes HTML completos directo en el chat mediante Telegram Document API.
- **Comandos de Sesión:** `/perfil` (ver cuenta activa) y `/logout` (cerrar sesión).

### 5. 📱 Webhook para WhatsApp / Meta Cloud API
- Recepción de mensajes en `/api/webhook` con validación de tokens de verificación Meta.
- Autenticación idéntica por número de teléfono vinculando la sesión a ControlT vía `/login`.

### 6. 🔌 Servidor MCP (Model Context Protocol) Autenticado
- Permite a cualquier IA externa (Claude Desktop, Cursor, Antigravity) conectarse a la Torre de Control ControlT.
- **Herramientas Expuestas:**
  - `controlt_login`: Autentica al operador y genera token de sesión MCP.
  - `controlt_get_eta_summary`: Semáforo ETA y viajes consolidados.
  - `controlt_get_active_alarms`: Cola de alarmas activas por prioridad.
  - `controlt_attend_alarm`: Atención individual de alarma con novedad y observación.
  - `controlt_batch_attend_on_time`: Atención en lote de llamadas de seguimiento.
  - `controlt_get_current_position`: Posición GPS en tiempo real por placa.
  - `controlt_get_binnacle`: Bitácora histórica de monitoreo de un viaje.
  - `controlt_get_attended_alarms`: Historial de alarmas atendidas en ControlT.

### 7. 🗄️ Base de Datos MySQL / MariaDB (Hostinger)
- Servidor: `srv2184.hstgr.io` (Base de datos: `u279856486_control_T`).
- Tablas automáticas con migración continua:
  - `viajes`: Telemetría y estado de la flota.
  - `alarmas`: Cola de eventos pendientes.
  - `atenciones_auditoria`: Registro inmutable de cada acción con operador y canal de origen.
  - `usuarios_controlt_sesiones`: Control de acceso y sesiones para Web, Telegram, WhatsApp y MCP.

---

## 🔑 Cómo Conectarse al Servidor MCP Autenticado

Dado que el sistema ahora exige autenticación obligatoria con credenciales de ControlT para proteger las operaciones de flota, existen **tres formas sencillas** de conectar una IA al servidor MCP:

### Método 1: Autenticación Conversacional en el Chat de la IA (Recomendado)
No requiere configurar credenciales estáticas. La IA tiene acceso a la herramienta `controlt_login`.
1. En tu cliente MCP (Claude Desktop, Antigravity, Cursor), configura la URL del endpoint:
   ```json
   {
     "mcpServers": {
       "controlt": {
         "url": "https://auto-trafico-ct.vercel.app/api/mcp"
       }
     }
   }
   ```
2. Cuando le pidas a la IA: *"Oye, consulta cómo van los viajes en ControlT"*, la IA detectará que no hay sesión y ejecutará `controlt_login` pidiéndote tu usuario y contraseña, o puedes indicarle:
   > *"Inicia sesión en ControlT con usuario operador@empresa.com y clave MiClave123 y luego atiende las alarmas a tiempo"*
3. La IA ejecuta `controlt_login`, recibe el token de sesión y queda autorizada para todas las herramientas subsiguientes.

---

### Método 2: Configuración con Encabezados HTTP (Headers Estáticos)
Si quieres que tu cliente MCP siempre esté conectado con tu cuenta personal de ControlT sin tener que escribir la contraseña en el chat:

Agrega en tu archivo `claude_desktop_config.json` o configuración MCP:
```json
{
  "mcpServers": {
    "controlt": {
      "url": "https://auto-trafico-ct.vercel.app/api/mcp",
      "headers": {
        "x-controlt-user": "tu_usuario@empresa.com",
        "x-controlt-password": "tu_contraseña_controlt"
      }
    }
  }
}
```
*También es compatible con token Bearer si ya tienes un token de sesión:*
```json
{
  "mcpServers": {
    "controlt": {
      "url": "https://auto-trafico-ct.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <TOKEN_DE_SESION>"
      }
    }
  }
}
```

---

### Método 3: Servidor Local Stdio (`mcp/server.ts`)
Para entornos locales o pipelines de terminal:
```json
{
  "mcpServers": {
    "controlt-local": {
      "command": "npx",
      "args": [
        "ts-node",
        "--esm",
        "C:/Users/GRAZIANY GOMEZ/OneDrive - DAABON/AA Systems/DEV/Auto_trafico-CT/mcp/server.ts"
      ],
      "env": {
        "CONTROLT_USERNAME": "tu_usuario@empresa.com",
        "CONTROLT_PASSWORD": "tu_contraseña_controlt"
      }
    }
  }
}
```

---

## 🛠️ Variables de Entorno Requeridas

Configura estas variables en tu archivo `.env.local` y en los **Environment Variables** de Vercel:

```env
# Credenciales Administrativas de ControlT (para Cron Jobs automáticos)
CONTROLT_API_URL=https://tower-api.controlt.com.co
CONTROLT_USERNAME=tu_correo_admin@empresa.com
CONTROLT_PASSWORD=tu_password_admin

# Base de Datos MySQL en Hostinger
MYSQL_HOST=srv2184.hstgr.io
MYSQL_USER=u279856486_control_T
MYSQL_PASSWORD=tu_password_mysql
MYSQL_DATABASE=u279856486_control_T
MYSQL_PORT=3306

# Proveedor de Inteligencia Artificial (OpenAI o Gemini)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
# GEMINI_API_KEY=AIzaSy...
# GEMINI_MODEL=gemini-2.5-flash

# Bot de Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Seguridad y Webhooks
WEBHOOK_VERIFY_TOKEN=token_seguro_meta_webhooks
NEXT_PUBLIC_APP_URL=https://auto-trafico-ct.vercel.app
```

---

## 🚀 Despliegue y Pruebas

1. **Instalación y build local:**
   ```bash
   npm install
   npm run build
   ```
2. **Subir a Producción (Vercel):**
   ```bash
   git add .
   git commit -m "feat: updates"
   git push origin main
   ```
3. **Verificación de Salud:**
   Accede a `https://auto-trafico-ct.vercel.app/api/health` para comprobar el estado de conexión con ControlT OAuth, MySQL Hostinger, Telegram y el motor de IA.
