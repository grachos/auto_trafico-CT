# Torre de Control Inteligente Elogia (ToCIE) 🚛🏢

Plataforma inteligente y torre de control de transporte y operaciones logísticas para **Elogia Soluciones Logísticas**, desarrollada en **Next.js 14 + TypeScript + Tailwind CSS**, desplegada en **Vercel**, conectada en tiempo real a las APIs de **ControlT**, **Telegram Bot**, **WhatsApp / Meta Webhooks**, base de datos **MySQL (Hostinger)** y con servidor **MCP (Model Context Protocol)** y **OAuth 2.0** para interactuar con cualquier IA externa (**ChatGPT**, **Claude.ai**, **Cursor**, **Antigravity**).

Dispone de una interfaz empresarial limpia de grado operativo inspirada en **ControlT Tower** con la identidad corporativa y paleta de colores de **Elogia** (verde salvia, slate y fondo neutral).

---

## 🌟 Módulos y Capacidades

### 1. 🔐 Autenticación Multiusuario con Credenciales de ControlT
- **Pantalla de Inicio de Sesión Previa:** Ningún operador puede ver el tablero sin antes autenticarse con su propio usuario y contraseña de ControlT Tower.
- **Icono de Ojo Interactivo 👁️:** Permite ver u ocultar la contraseña con un solo clic (`Eye` / `EyeOff`).
- **Validación en Vivo contra OAuth de ControlT:** Conexión directa a `POST https://app.controlt.com.co/apipublic/api/login/oauth`.
- **Sesiones Seguras en MySQL:** Las sesiones activas se persisten en la tabla `usuarios_controlt_sesiones` con cookies HTTP-only (`ct_session_token`).
- **Variables Administrativas Preservadas:** Las credenciales configuradas en el `.env` de Vercel se mantienen para la ejecución autónoma de tareas programadas en segundo plano (crons).

### 2. 👥 Gestión de Usuarios, Roles y Control de Acceso (Exclusivo Administrador)
- **Acceso para Administradores:** El botón **"👥 Gestión Usuarios [ADMIN]"** en el encabezado es visible para `ggomez@elogia.com.co` y para cualquier usuario promovido a `ADMIN`.
- **Asignación Dinámica de Roles:** En el modal de gestión, los administradores disponen de un selector directo en la columna **Rol** para alternar entre `👤 Operador` y `🛡️ Admin`. Al promover a un usuario, este adquiere permisos inmediatos para gestionar otros operadores, conmutar el Piloto de Seguimiento y controlar las Alertas Críticas.
- **Protección del Administrador Principal:** `ggomez@elogia.com.co` está blindado a nivel de base de datos e interfaz gráfica como **Admin Principal** (no puede ser degradado ni desactivado por ningún otro usuario).
- **Registro Centralizado Automático:** Al ingresar por primera vez (vía Web, Telegram, WhatsApp o MCP), cualquier operador de ControlT queda registrado automáticamente en la tabla `usuarios_controlt_registro` en estado `ACTIVO` con rol `OPERADOR`.
- **Panel Administrativo con Métricas:** Modal interactivo con buscador en tiempo real, contador de usuarios totales, activos e inactivos, historial de accesos y canales utilizados.
- **Activación / Desactivación en Vivo:** El administrador puede alternar el estado del usuario entre `ACTIVO` e `INACTIVO` con un solo clic.
- **Revocación Inmediata de Sesiones:** Al desactivar a un operador, todas sus sesiones activas en MySQL (`usuarios_controlt_sesiones`) se cierran al instante.
- **Bloqueo Omnicanal Estricto:** Si un usuario inactivo intenta ingresar o consultar por Web, Telegram, WhatsApp, MCP o flujo OAuth 2.0, el sistema rechaza la solicitud de inmediato con el mensaje:
  > *"❌ Tu usuario se encuentra inactivo en la plataforma. Comunícate con el administrador (ggomez@elogia.com.co) para solicitar activación."*

### 3. 🚨 Motor de Monitoreo Periódico Inteligente y Piloto Automático 24/7
- **Interruptor Maestro con Control Exclusivo para el Administrador:** Solo `ggomez@elogia.com.co` puede activar o pausar el Piloto Automático. Los demás operadores ven el estado en modo lectura protegida.
- **Persistencia Global en MySQL:** Al activarlo, el estado se guarda en `configuracion_sistema` y permanece activo 24/7 incluso con pestañas y computadores cerrados.
- **Control Omnicanal por Instrucción:**
  - **Desde la Web:** Clic en el botón interactivo `[ 📈 Piloto Automático: MANUAL / ACTIVO ]`.
  - **Desde Telegram:** Comandos `/piloto on`, `/piloto off`, `/piloto` o en texto libre: *"activa el piloto automático"*, *"desactiva el piloto"*.
  - **Desde el Copiloto ToCIE:** Órdenes conversacionales directas en el chat.
- **Detección Automática de Anomalías Críticas de Seguridad:**
  - 🚨 **Fuera de Ruta:** Desvíos y abandono de corredor logístico.
  - ⛔ **Zonas Prohibidas:** Detenciones o tránsito en puntos rojos y sectores no autorizados.
  - ⚡ **Exceso de Velocidad:** Telemetría superior al umbral configurado (> 80 km/h).
  - 🛑 **Retrasos Críticos:** Viajes en estado *Tarde* con riesgo de pérdida de cita en clientes clave.
- **Despacho Automático de Emergencia a Telegram:** Genera tarjetas ejecutivas con emojis y botones interactivos:
  - `[📞 Llamar Conductor]` (llamada telefónica directa de un toque).
  - `[🗺️ Ver en Google Maps]` (apertura de coordenadas GPS en mapa).
  - `[🌐 Abrir Tablero ToCIE]` (enlace a la plataforma).
- **Filtro Anti-Spam en MySQL (60 min):** Registro en `alertas_notificadas` para evitar saturación y no repetir alertas de una misma unidad dentro de la misma hora.
- **Configuración en Hostinger Cron:** Se programa una única vez en Hostinger hPanel cada 10 minutos ejecutando:
  ```bash
  curl -s "https://auto-trafico-ct.vercel.app/api/cron/sync-and-attend"
  ```

### 3. 🤖 Motor de Agente IA con Function Calling
- **Modelos Compatibles:** OpenAI (`gpt-4o-mini`) y Google Gemini (`gemini-2.5-flash`), con soporte para fallback determinístico.
- **Function Calling Nativo:** El agente consulta viajes, filtra estados ETA, extrae la posición GPS y atiende alarmas directamente llamando funciones del sistema.
- **Formateo Antirrotura en Tarjetas Ejecutivas:** Toda la información de vehículos se presenta en tarjetas legibles con emojis (`🚛 Placa`, `• Conductor`, `• Ubicación`, etc.), evitando tablas desbordadas o partidas en celulares y Telegram.
- **Paginación Eficiente (5 vehículos por bloque):** Ahorro drástico de tokens con navegación interactiva.

### 4. 📄 Exportación Tabular y Reportes en Pantalla Completa (Cero Tokens)
- **Visualizador HTML / PDF:** Botón directo *"🌐 Ver Tabla Completa / PDF"* en el chat web y en Telegram.
- **Generación Local sin IA:** Consulta directamente MySQL, genera tablas estilizadas con filtros rápidos por semáforo ETA y permite imprimir o descargar en PDF sin consumir tokens de OpenAI/Gemini.

### 5. ✈️ Bot de Telegram con Control de Acceso
- **Compuerta de Seguridad:** Si un operador no está registrado, el bot bloquea el acceso y le solicita:
  ```text
  /login <tu_usuario_controlt> <tu_contraseña>
  ```
- **Botones Interactivos:** Atender alarmas a tiempo en lote, consultar semáforo ETA, ver alarmas críticas y navegar páginas de vehículos.
- **Envío de Documentos:** Descarga de reportes HTML completos directo en el chat mediante Telegram Document API.
- **Comandos de Sesión:** `/perfil` (ver cuenta activa) y `/logout` (cerrar sesión).

### 6. 📱 Webhook para WhatsApp / Meta Cloud API
- Recepción de mensajes en `/api/webhook` con validación de tokens de verificación Meta.
- Autenticación idéntica por número de teléfono vinculando la sesión a ControlT vía `/login <usuario> <contraseña>`.

### 7. 🔌 Servidor MCP (Model Context Protocol) con Seguridad Estricta y OAuth 2.0
- Compatible con **ChatGPT (Custom GPTs / Actions / Connectors)**, **Claude.ai**, **Cursor** y **Antigravity**.
- **Bloqueo Estricto de Acceso:** Ninguna herramienta entrega datos de viajes o permite atender alarmas hasta que el operador se haya autenticado. Si un usuario no autenticado hace una pregunta en ChatGPT, el servidor retorna un error de autenticación instruyendo a la IA a solicitar usuario y contraseña.
- **Conexión en Vivo con la API de ControlT:** Las herramientas operativas (`controlt_get_eta_summary` y `controlt_get_active_alarms`) consultan en tiempo real la flota activa (~160+ viajes) y la cola de alarmas directamente de los servidores de ControlT.
- **Soporte Robusto para Tokens Bearer / JWT:** Autenticación fluida con tokens JWT emitidos por ControlT (~700 caracteres), con validación híbrida en MySQL (`token_controlt`) e inspección en memoria de vigencia del token y verificación de estado activo del usuario.
- **Herramientas Expuestas:**
  - `controlt_login`: Autentica al operador y genera token de sesión MCP en tiempo real.
  - `controlt_get_eta_summary`: Semáforo ETA y viajes consolidados en tiempo real (Requiere autenticación).
  - `controlt_get_active_alarms`: Cola de alarmas activas por prioridad en tiempo real (Requiere autenticación).
  - `controlt_attend_alarm`: Atención individual de alarma con novedad y observación en ControlT y auditoría MySQL.
  - `controlt_batch_attend_on_time`: Atención en lote de llamadas de seguimiento en tiempo real.
  - `controlt_get_current_position`: Posición GPS en tiempo real por placa.
  - `controlt_get_binnacle`: Bitácora histórica de monitoreo de un viaje.
  - `controlt_get_attended_alarms`: Historial de alarmas atendidas en ControlT.

### 8. 🗄️ Base de Datos MySQL / MariaDB (Hostinger)
- Servidor: `srv2184.hstgr.io` (Base de datos: `u279856486_control_T`).
- Tablas automáticas con migración continua:
  - `viajes`: Telemetría y estado de la flota.
  - `alarmas`: Cola de eventos pendientes.
  - `atenciones_auditoria`: Registro inmutable de cada acción con operador y canal de origen.
  - `usuarios_controlt_registro`: Directorio maestro de operadores con roles (`ADMIN`/`OPERADOR`), estado (`ACTIVO`/`INACTIVO`), timestamps de primer y último acceso.
  - `usuarios_controlt_sesiones`: Control de acceso y sesiones para Web, Telegram, WhatsApp, MCP y OAuth.

---

## 🔑 Cómo Conectar ChatGPT, Claude o Cualquier IA al Servidor MCP

El sistema ofrece dos formas de autenticar al usuario en ChatGPT o Claude:

---

### Método A: Autenticación Conversacional en el Chat (Sin configuración extra)
Si conectas el MCP con la opción por defecto (**No Auth**):
1. **URL del conector:** `https://auto-trafico-ct.vercel.app/api/mcp`
2. Cuando le pidas a ChatGPT en el chat: *"¿Cómo van los carros de Mabe?"* o *"Atiende las alarmas a tiempo"*:
3. El servidor MCP **rechaza la consulta** e instruye a ChatGPT:
   > 🔒 *Acceso denegado. El usuario debe iniciar sesión primero.*
4. ChatGPT se detendrá y te solicitará:
   > *"Para acceder a los datos de ControlT, por favor indícame tu usuario/correo y contraseña de ControlT."*
5. Una vez le indicas tus credenciales, ChatGPT ejecuta la herramienta `controlt_login`, se valida contra ControlT OAuth, se almacena la sesión en MySQL y se desbloquean todas las consultas a nombre de ese operador.

---

### Método B: Flujo OAuth 2.0 con Pantalla de Login (Recomendado para ChatGPT)
Para que al hacer clic en **"Connect Control T"** en ChatGPT se abra la ventana emergente oficial de inicio de sesión:

Al configurar el conector o Custom GPT en ChatGPT:
1. En **Authentication Type**, selecciona **OAuth**.
2. Completa los campos con las siguientes URLs:
   - **Authorization URL:** `https://auto-trafico-ct.vercel.app/oauth/authorize`
   - **Token URL:** `https://auto-trafico-ct.vercel.app/oauth/token`
   - **Client ID:** `controlt_client` (o el nombre que desees)
   - **Client Secret:** `controlt_secret` (o cualquier clave)
   - **Scope:** *(dejar vacío)*
3. Al guardar y hacer clic en **Connect Control T**, ChatGPT abrirá una ventana emergente en `auto-trafico-ct.vercel.app/oauth/authorize` con el formulario seguro de ControlT y el **icono del ojo 👁️**.
4. Ingresas tu usuario y contraseña de ControlT, presionas **"Autorizar y Conectar"**, y la ventana se cerrará vinculando tu cuenta de forma permanente en ChatGPT con un Bearer Token OAuth 2.0.

---

### Método C: Encabezados HTTP Fijos (Claude Desktop / Cursor)
En el archivo `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "controlt": {
      "url": "https://auto-trafico-ct.vercel.app/api/mcp",
      "headers": {
        "x-controlt-user": "operador@empresa.com",
        "x-controlt-password": "tu_contraseña_controlt"
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
