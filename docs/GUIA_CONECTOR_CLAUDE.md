# Guía de Conexión de Claude con el Servidor MCP ToCIE (ControlT)

Esta guía explica paso a paso cómo conectar **Claude** (Claude Desktop, Claude Web y Claude Mobile) al Servidor MCP Remoto de la Torre de Control Inteligente Elogia (**ToCIE**) para operar ControlT en lenguaje natural sin exponer contraseñas.

---

## 1. Requisitos Previos

1. Tu servidor ToCIE debe estar desplegado en un dominio público con HTTPS (por ejemplo `https://tucocontrolt.vercel.app` o tu dominio personalizado).
2. Tener una cuenta activa en ControlT asociada a tu correo corporativo.
3. Haber registrado tus credenciales de ControlT una sola vez a través del enlace seguro del servidor (almacenadas con cifrado AES-256-GCM).

---

## 2. Generación del Ticket de Acceso (En la Web de ToCIE)

Nunca debes escribir tu contraseña de ControlT en el chat de Claude ni en la pantalla de autorización del conector.

1. Abre en tu navegador la página de gestión MCP:
   ```text
   https://<tu-dominio>/mcp
   ```
2. Inicia sesión con tu correo corporativo.
3. Haz clic en el botón **"Generar Nuevo Ticket"**.
4. El sistema generará un código de un solo uso con formato:
   ```text
   XXXX-XXXX-XXXX-XXXX
   ```
   *(Este ticket tiene una vigencia de 15 minutos y se invalida automáticamente tras ser canjeado).*
5. Copia el ticket al portapapeles.

---

## 3. Conexión en Claude Desktop

### Opción A: Conexión Remota Streamable HTTP (Recomendada)

1. Abre el archivo de configuración de Claude Desktop:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Agrega la configuración del servidor MCP ToCIE:

```json
{
  "mcpServers": {
    "controlt-tocie": {
      "url": "https://<tu-dominio>/api/mcp",
      "transport": "http"
    }
  }
}
```

*Nota para Claude Desktop con Bearer Token directo (modo administrativo/pruebas):*
```json
{
  "mcpServers": {
    "controlt-tocie": {
      "url": "https://<tu-dominio>/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer <TU_MCP_ADMIN_API_KEY>",
        "x-controlt-user": "tu_usuario@elogia.com.co"
      }
    }
  }
}
```

3. Reinicia Claude Desktop.
4. El martillo de herramientas (Tools icon) mostrará las herramientas de ControlT disponibles (`consultar_viajes`, `consultar_alarmas`, `consultar_gps`, `atender_alarma`, `atender_lote_a_tiempo`, etc.).

---

## 4. Conexión en Claude Web y Claude Mobile (OAuth 2.1)

Cuando Anthropic habilita la adición de conectores MCP remotos vía OAuth 2.1:

1. Ve a **Settings** > **Connectors** (o **Integrations**).
2. Selecciona **Add Custom MCP Connector**.
3. Ingresa la URL del servidor:
   ```text
   https://<tu-dominio>/api/mcp
   ```
4. Claude detectará automáticamente la metadata OAuth 2.1 en `/.well-known/oauth-authorization-server` y te redirigirá a la pantalla de autorización:
   ```text
   https://<tu-dominio>/oauth/authorize
   ```
5. En la pantalla:
   - **Correo Corporativo:** Ingresa tu correo (ej. `tu_usuario@elogia.com.co`).
   - **Ticket de Acceso:** Pega el ticket `XXXX-XXXX-XXXX-XXXX` obtenido en el Paso 2.
6. Haz clic en **"Autorizar Conexión"**.
7. La conexión quedará enlazada a tu dispositivo con un token firmado HMAC con refresco automático de 30 días.

---

## 5. Pruebas de Operación en Lenguaje Natural

Una vez conectado, puedes interactuar con Claude usando lenguaje completamente natural:

### Consultas de Flota y Puntualidad
- *"¿Cómo está el estado de la flota hoy?"*
- *"Muéstrame cuántos vehículos van a tiempo y cuántos van retrasados."*
- *"¿Cuáles vehículos tienen un avance mayor al 50%?"*
- *"¿Qué vehículos están actualmente quietos o detenidos?"*

### Telemetría GPS en Vivo
- *"¿Dónde se encuentra exactamente el vehículo con placa KUS253 y a qué velocidad va?"*
- *"Muestra la ubicación y último reporte del viaje 0101227165."*

### Gestión de Alarmas
- *"¿Cuáles son las alarmas críticas o de prioridad alta pendientes en ControlT?"*
- *"Revisa si hay alarmas para la placa SLE740."*
- *"Atiende la alarma 267981351 con la observación 'Vehículo reporta tráfico fluido en peaje'."*
- *"Atiende en lote las alarmas de los vehículos que van a tiempo."*

---

## 6. Gestión y Revocación de Accesos

Puedes auditar y revocar las sesiones conectadas en cualquier momento:

1. Entra a `https://<tu-dominio>/mcp`.
2. En la sección **"Conexiones AI Activas"** verás cada dispositivo conectado con su fecha de creación y último uso.
3. Haz clic en **"Revocar Acceso"** en cualquier conexión. La invalidación es inmediata en base de datos; cualquier llamada posterior desde ese cliente será rechazada con `CONNECTION_REVOKED`.

