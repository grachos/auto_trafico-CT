# Guía de Conexión de ChatGPT con el Servidor MCP ToCIE (ControlT)

Esta guía detalla cómo conectar **ChatGPT** (Web y Móvil) mediante una **Acción Personalizada (Custom Action / GPT Conector)** al Servidor MCP Remoto de la Torre de Control Inteligente Elogia (**ToCIE**).

---

## 1. Requisitos Previos

- Cuenta de OpenAI con acceso a creación de GPTs (ChatGPT Plus, Team o Enterprise).
- Servidor ToCIE desplegado en HTTPS (ej. `https://<tu-dominio>`).
- Credenciales de ControlT configuradas de forma segura en la plataforma ToCIE.

---

## 2. Generación del Ticket de Acceso (En ToCIE)

Nunca pegues tu contraseña de ControlT en ChatGPT.

1. Ve a:
   ```text
   https://<tu-dominio>/mcp
   ```
2. Inicia sesión con tu correo corporativo.
3. Presiona **"Generar Nuevo Ticket"**.
4. Copia el ticket generado (formato `XXXX-XXXX-XXXX-XXXX`, válido por 15 minutos).

---

## 3. Configuración en ChatGPT (Crear GPT / Acción)

1. En ChatGPT, ve a **Explore GPTs** > **Create** (o entra al editor de tu GPT existente).
2. Ve a la pestaña **Configure**.
3. En la sección inferior, selecciona **Create new action** (Crear nueva acción).
4. Configura los parámetros:

### A. Autenticación (Authentication)
- **Authentication Type:** Selecciona `OAuth`.
- **Client ID:** `chatgpt-connector` (o el identificador asignado).
- **Client Secret:** `secret-public-oauth` (o déjalo en blanco si usas PKCE público).
- **Authorization URL:**
  ```text
  https://<tu-dominio>/oauth/authorize
  ```
- **Token URL:**
  ```text
  https://<tu-dominio>/api/oauth/token
  ```
- **Scope:**
  ```text
  controlt:read controlt:write
  ```
- **Token Exchange Method:** `Default (POST request with body)`.

### B. Esquema de la API (Schema)
El servidor soporta la especificación OpenAPI para ChatGPT o el transporte Streamable HTTP JSON-RPC 2.0 en `https://<tu-dominio>/api/mcp`.

---

## 4. Autorización del Operador

1. Al interactuar por primera vez con el GPT, aparecerá un botón **"Sign in with <tu-dominio>"** o **"Authorize"**.
2. Haz clic en el botón. Se abrirá la pantalla de autorización segura de ToCIE:
   ```text
   https://<tu-dominio>/oauth/authorize
   ```
3. Ingresa tu correo corporativo y pega el **Ticket de Acceso** (`XXXX-XXXX-XXXX-XXXX`).
4. Haz clic en **"Autorizar Conexión"**.
5. La ventana emergente se cerrará y ChatGPT quedará conectado directamente a ControlT con tu identidad corporativa.

---

## 5. Regla Fundamental de ChatGPT: Manejo de Caché de Herramientas

> [!WARNING] **IMPORTANTE: Comportamiento de Caché en ChatGPT**
> ChatGPT almacena en caché la lista y esquema de herramientas el día en que se crea el conector o la acción y **no la refresca automáticamente**, incluso si el servidor actualiza su catálogo.
> - Si se actualizan o agregan herramientas en el servidor ToCIE, debes **eliminar la acción y volver a crearla** en el GPT para que descargue el esquema nuevo.
> - El servidor ToCIE incluye alias retrocompatibles (como `controlt_get_binnacle`, `controlt_attend_alarm`, etc.) para tolerar clientes que utilicen la lista anterior.

---

## 6. Ejemplos de Instrucciones en Lenguaje Natural

Una vez enlazado, puedes pedirle a ChatGPT:

- *"¿Cuántos vehículos van en tránsito y cuál es el porcentaje de puntualidad actual?"*
- *"Muéstrame el listado de vehículos con avance mayor o igual al 50%."*
- *"¿Cuántos vehículos están quietos?"*
- *"¿Dónde está el carro de placa SLE740?"*
- *"Revisa las alarmas pendientes de alta prioridad."*
- *"Atiende las alarmas de los vehículos que van a tiempo."*
- *"Atiende la alarma ID 268037808 indicando que se contactó al conductor y reporta ruta despejada."*

Todas las atenciones quedarán registradas en ControlT a nombre de tu usuario real y auditadas en la base de datos de ToCIE.

---

## 7. Revocación Inmediata

Si pierdes tu dispositivo o deseas cerrar el acceso de ChatGPT:
1. Ingresa a `https://<tu-dominio>/mcp`.
2. Ubica la conexión de ChatGPT en la lista y presiona **"Revocar Acceso"**.
3. El conector quedará bloqueado de forma inmediata en todas las sesiones.

