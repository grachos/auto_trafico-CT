# CONTEXTO DEL PROYECTO Y GUÍA TÉCNICA PARA IA (PROJECT CONTEXT)

> **Documento maestro de arquitectura, reglas de negocio y diseño operativo para el sistema Auto_trafico-CT.**  
> Diseñado para que cualquier agente de inteligencia artificial o desarrollador pueda comprender inmediatamente el contexto, flujo de datos, integración con ControlT, Telegram, Base de Datos MySQL (Hostinger), Servidor MCP autenticado y flujo OAuth 2.0.

---

## 1. Visión y Propósito del Proyecto

**Auto_trafico-CT** es una solución de automatización y torre de control asistida por inteligencia artificial diseñada para interactuar con la plataforma logística **ControlT** (`https://tower.controlt.com.co`).

### Capacidades del Sistema:
1. **Autenticación Multiusuario:** Cualquier operador con credenciales asignadas en ControlT puede ingresar a la plataforma web (`LoginForm.tsx` con toggle de visibilidad de clave 👁️), vincular su chat en Telegram (`/login`), WhatsApp y conectarse por MCP/OAuth en ChatGPT o Claude.
2. **Seguridad Estricta en MCP:** El servidor MCP no entrega datos ni atiende alarmas hasta que el usuario se haya identificado con sus credenciales de ControlT (ya sea mediante la herramienta conversacional `controlt_login` o mediante el flujo OAuth 2.0).
3. **Flujo Completo OAuth 2.0:** Endpoints `/oauth/authorize` (con pantalla de login y toggle de contraseña) y `/oauth/token` para conectar ChatGPT Custom Actions / Connectors de forma nativa.
4. **Monitoreo Continuo y Clasificación:** Analizar viajes activos (~170 unidades) y cruzar el estado del **Semáforo ETA** (A tiempo, Tarde, Tolerancia) con las **Alarmas por atender** (Crítica, Alta, Media, Baja).
5. **Atención Desatendida / Agente Autónomo:** Atender automáticamente las alarmas rutinarias (*LLAMADA DE SEGUIMIENTO*) para vehículos en estado **A tiempo**, consultando su último evento y registrando la novedad en ControlT sin demora humana.
6. **Escalamiento y Alerta Humana:** Identificar y priorizar de inmediato las unidades con retraso (**TARDE**) o alarmas de seguridad (**CRÍTICA** como *FUERA DE RUTA*) para que el equipo operativo intervenga telefónicamente.
7. **Agente Conversacional Omnicanal (Telegram, Web & WhatsApp):** Permitir al usuario dar órdenes en texto libre tanto en la interfaz web de la aplicación (desplegada en Vercel) como a través de un **Bot de Telegram** y webhook de WhatsApp.
8. **Formato Antirrotura en Tarjetas:** Reglas estrictas y parser bidireccional (`lib/format-utils.ts`) para evitar tablas quebradas en pantallas móviles y chats; soporte para visor HTML/PDF de tablas con cero consumo de tokens.
9. **Persistencia y Auditoría en Base de Datos (MySQL en Hostinger):** Registro inmutable en `atenciones_auditoria` y control de sesiones activas en `usuarios_controlt_sesiones`.

---

## 2. Dominio Logístico y Plataforma ControlT

### A. Vista Resumen (`/home/summary`)
- **N° de Viaje:** 10 dígitos (ej. `0101226422`).
- **Placa:** Matrícula del vehículo de carga (ej. `KNL064`).
- **Semáforo ETA:**
  - 🟢 **`A_TIEMPO` (`stateNextPoint1`):** Cumple o anticipa la cita del cliente (~70% de la flota).
  - 🔴 **`TARDE` (`stateNextPoint3`):** Llegará después de la cita (~25% de la flota).
  - 🟡 **`TOLERANCIA` (`stateNextPoint2`):** Margen aceptable.
  - ⚪ **`SIN_CALCULO`:** Telemetría insuficiente.
- **Último Evento:** Registro del evento GPS más reciente.

### B. Vista Alarmas por Atender (`/home/alarmstoattend`)
- **Niveles de Prioridad:**
  - 🔴 **Crítica:** Máxima severidad (ej. `FUERA DE RUTA`, botón de pánico).
  - 🟠 **Alta:** Prioritarios de seguimiento (ej. `LLAMADA DE SEGUIMIENTO`, demoras de cargue).
  - 🟡 **Media** y 🟢 **Baja:** Eventos informativos o `PROXIMIDAD DE DESTINO`.
- **Formulario de Atención:** Selector de Novedad, campo de comentario (obligatorio) y confirmación de guardado.

---

## 3. Protocolo Estándar de Atención de Alarmas
1. **Consulta en Resumen:** Capturar *Último evento*, velocidad y ubicación.
2. **Navegación a Alarmas:** Localizar alarma por N° Viaje o Placa.
3. **Mapeo Semántico:** Asignar la novedad adecuada (*"En ruta sin novedad alguna"* para llamadas de seguimiento).
4. **Redacción de Comentario:** *"Vehículo en tránsito a {V} km/h en {Ubicación}. Ruta sin novedad alguna."*
5. **Guardado en ControlT:** Envío al endpoint oficial `POST /Home/alarms/attendForUI`.
6. **Auditoría Local:** Registro en tabla MySQL `atenciones_auditoria` con el usuario que ejecutó la acción.

---

## 4. Arquitectura de Software

```
Auto_trafico-CT/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   └── users/route.ts         <-- Gestión de usuarios (GET/POST) exclusivo ggomez@elogia.com.co
│   │   ├── auth/
│   │   │   ├── login/route.ts         <-- Login multiusuario contra ControlT OAuth y cookie
│   │   │   ├── me/route.ts            <-- Verificación de sesión activa
│   │   │   └── logout/route.ts        <-- Cierre de sesión y limpieza de cookie
│   │   ├── chat/route.ts              <-- Endpoint conversacional IA (texto libre web)
│   │   ├── reportes/
│   │   │   └── tabla/route.ts         <-- Vista HTML/PDF tabla completa sin tokens
│   │   ├── controlt/
│   │   │   ├── summary/route.ts       <-- API de Semáforo ETA y viajes
│   │   │   ├── alarms/route.ts        <-- API de Alarmas activas
│   │   │   └── attend/route.ts        <-- API para atender individual o batch
│   │   ├── telegram/
│   │   │   ├── setup/route.ts         <-- Configuración automática del Webhook
│   │   │   └── webhook/route.ts       <-- Webhook del Bot (autenticado con /login)
│   │   ├── webhook/route.ts           <-- Webhook Meta WhatsApp / Instagram
│   │   ├── health/route.ts            <-- Diagnóstico general de servicios
│   │   ├── mcp/route.ts               <-- Servidor MCP con bloqueo de auth y tools/call
│   │   └── oauth/
│   │       └── authorize/route.ts     <-- Endpoint backend de validación de credenciales OAuth
│   ├── oauth/
│   │   ├── authorize/page.tsx         <-- Pantalla web de login OAuth con botón de ojo 👁️
│   │   └── token/route.ts             <-- Endpoint OAuth 2.0 para canjear code por access_token
│   ├── layout.tsx                     <-- Layout principal
│   └── page.tsx                       <-- Dashboard protegido por LoginForm con modal de admin
├── components/
│   ├── LoginForm.tsx                  <-- Pantalla de login previo con toggle de ojo 👁️
│   ├── UserManagementModal.tsx        <-- Panel modal de gestión de usuarios (activar/desactivar)
│   ├── Navbar.tsx                     <-- Header con estado de usuario, botón ADMIN y logout
│   ├── KpiCards.tsx                   <-- Tarjetas de métricas superiores
│   ├── ReportsView.tsx                <-- Tablas interactivas y exportación Excel (.xlsx)
│   └── TrafficChat.tsx                <-- Drawer conversacional con tarjetas ejecutivas
├── lib/
│   ├── db.ts                          <-- Pool MariaDB/MySQL Hostinger, tabla usuarios_controlt_registro
│   ├── controlt-service.ts            <-- Cliente API ControlT con OAuth y authenticateUser()
│   ├── format-utils.ts                <-- Parser antirrotura de tablas a tarjetas ejecutivas
│   ├── report-generator.ts            <-- Generador de reportes tabulares y paginación rápida
│   ├── ai-service.ts                  <-- Servicio OpenAI/Gemini con Function Calling
│   ├── telegram-service.ts            <-- Envío de mensajes y documentos en Telegram
│   ├── data-store.ts                  <-- Almacén singleton en memoria / sincronizador
│   └── traffic-agent.ts               <-- Orquestador de intenciones y acciones
├── mcp/
│   └── server.ts                      <-- Servidor MCP Stdio para clientes locales
└── types/
    └── index.ts                       <-- Tipos TypeScript
```

---

## 5. Control de Acceso y Sesiones Omnicanal

Cada canal valida la identidad del operador contra ControlT:
- **Web App:** `POST /api/auth/login` $\rightarrow$ Cookie segura `ct_session_token` $\rightarrow$ MySQL `usuarios_controlt_sesiones`.
- **Telegram Bot:** Comando `/login <usuario> <contraseña>` vincula el `chatId` del operador.
- **WhatsApp:** Mismo patrón vía webhook `/login <usuario> <contraseña>`.
- **ChatGPT / MCP:**
  - *Vía Chat:* Bloqueo estricto que instruye al modelo a solicitar credenciales y llamar a `controlt_login`.
  - *Vía OAuth 2.0:* Ventana de login en `/oauth/authorize` con token canjeado en `/oauth/token`.

---

## 6. Módulo de Gestión de Usuarios y Roles (Exclusivo Administrador Principal)

- **Administrador Maestro:** `ggomez@elogia.com.co` (rol `ADMIN`).
- **Registro Automático de Primer Ingreso:** La tabla `usuarios_controlt_registro` almacena automáticamente a cualquier operador que inicie sesión por primera vez por cualquiera de los canales autorizados.
- **Activación / Desactivación:** El administrador puede alternar en tiempo real el estado (`ACTIVO` / `INACTIVO`).
- **Cierre Inmediato de Sesiones:** Al marcar a un operador como `INACTIVO`, se ejecuta una invalidación inmediata en `usuarios_controlt_sesiones` (`activo = 0`).
- **Bloqueo Omnicanal de Inactivos:** Si un operador en estado `INACTIVO` intenta ingresar por la web, interactuar en Telegram o WhatsApp, o consultar el servidor MCP / OAuth, el sistema bloquea la acción con:
  > *"❌ Tu usuario se encuentra inactivo en la plataforma. Comunícate con el administrador (ggomez@elogia.com.co) para solicitar activación."*
- **Inmunidad del Administrador Principal:** Protegido contra desactivación a nivel de base de datos e interfaz gráfica.
