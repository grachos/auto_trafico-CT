# CONTEXTO DEL PROYECTO Y GUÍA TÉCNICA PARA IA (PROJECT CONTEXT)

> **Documento maestro de arquitectura, reglas de negocio y diseño operativo para Torre de Control Inteligente Elogia (ToCIE).**  
> Diseñado para que cualquier agente de inteligencia artificial o desarrollador pueda comprender inmediatamente el contexto, flujo de datos, integración con ControlT, Telegram, Base de Datos MySQL (Hostinger), Servidor MCP autenticado, flujo OAuth 2.0 y la interfaz corporativa Elogia.

---

## 1. Visión y Propósito del Proyecto

**Torre de Control Inteligente Elogia (ToCIE)** es una solución empresarial de automatización y torre de control de transporte de carga pesada desarrollada para **Elogia Soluciones Logísticas**, diseñada para interactuar con la plataforma logística **ControlT** (`https://tower.controlt.com.co`).

### Identidad Corporativa y Diseño UI:
- **Nombre Oficial:** Torre de Control Inteligente Elogia (ToCIE).
- **Paleta de Colores Elogia:** Verde Salvia (`#758F79`, `#5F7663`, `#263028`), gris neutro (`#F7F9F7`), y acentos discretos.
- **Inspiración:** Layout de alta densidad operativa inspirado directamente en **ControlT Tower**, sustituyendo estéticas genéricas de chatbots o juguetes IA por una consola ejecutiva logística.
- **Logotipo e Icono:** Logotipo oficial de Elogia implementado como favicon y encabezado en todos los puntos de contacto.

### Capacidades del Sistema:
1. **Autenticación Multiusuario:** Cualquier operador con credenciales asignadas en ControlT puede ingresar a la plataforma web (`LoginForm.tsx` con toggle de visibilidad de clave 👁️), vincular su chat en Telegram (`/login`), WhatsApp y conectarse por MCP/OAuth en ChatGPT o Claude.
2. **Seguridad Estricta en MCP:** El servidor MCP no entrega datos ni atiende alarmas hasta que el usuario se haya identificado con sus credenciales de ControlT (ya sea mediante la herramienta conversacional `controlt_login` o mediante el flujo OAuth 2.0).
3. **Flujo Completo OAuth 2.0:** Endpoints `/oauth/authorize` (con pantalla de login y toggle de contraseña) y `/oauth/token` para conectar ChatGPT Custom Actions / Connectors de forma nativa.
4. **Motores Independientes de Monitoreo y Seguimiento (24/7):** Motor de fondo (`lib/monitoring-engine.ts`) con separación estricta entre:
   - **Piloto de Seguimiento:** Cierra automáticamente en ControlT llamadas de seguimiento rutinarias para viajes *A Tiempo*.
   - **Alertas Críticas de Seguridad:** Escaneo continuo de **Fuera de Ruta**, ingreso a **Zonas Prohibidas** y **Excesos de Velocidad (>80 km/h)**, despachando alertas inmediatas a Telegram con botones interactivos de WhatsApp y Google Maps.
5. **Controles Independientes para Administradores:** Tanto `ggomez@elogia.com.co` como cualquier operador promovido a `ADMIN` disponen de interruptores independientes en la barra superior (Navbar) y comandos en Telegram (`/seguimiento on|off` y `/alertas on|off`), persistidos en MySQL `configuracion_sistema`.
6. **Filtro Anti-Spam en MySQL:** Registro en `alertas_notificadas` para evitar saturación y no duplicar alertas del mismo vehículo y evento en una ventana de 60 minutos.
7. **Gestión Administrativa de Operadores y Asignación de Roles:** Panel de administración con métricas, control de acceso activo/inactivo omnicanal y asignación dinámica de roles (`ADMIN` u `OPERADOR`) para delegar permisos de supervisión sin comprometer al administrador principal.
8. **Formato Antirrotura en Tarjetas:** Reglas estrictas y parser bidireccional (`lib/format-utils.ts`) para evitar tablas quebradas en pantallas móviles y chats; soporte para visor HTML/PDF de tablas con cero consumo de tokens.
9. **Persistencia y Auditoría en Base de Datos (MySQL en Hostinger):** Registro inmutable en `atenciones_auditoria`, `alertas_notificadas` y `configuracion_sistema`.

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
│   │   │   ├── config/route.ts        <-- Configuración global (piloto_seguimiento, alertas_seguridad)
│   │   │   ├── test-alert/route.ts    <-- Diagnóstico y prueba en vivo de alertas a Telegram
│   │   │   └── users/route.ts         <-- Gestión de usuarios y asignación de roles (ADMIN/OPERADOR)
│   │   ├── auth/
│   │   │   ├── login/route.ts         <-- Login multiusuario contra ControlT OAuth y cookie
│   │   │   ├── me/route.ts            <-- Verificación de sesión activa
│   │   │   └── logout/route.ts        <-- Cierre de sesión y limpieza de cookie
│   │   ├── cron/
│   │   │   └── sync-and-attend/route.ts <-- Endpoint autónomo para Cron Job de Hostinger (cada 10 min)
│   │   ├── chat/route.ts              <-- Endpoint conversacional IA (texto libre web)
│   │   ├── reportes/
│   │   │   └── tabla/route.ts         <-- Vista HTML/PDF tabla completa sin tokens
│   │   ├── controlt/
│   │   │   ├── summary/route.ts       <-- API de Semáforo ETA y viajes
│   │   │   ├── alarms/route.ts        <-- API de Alarmas activas
│   │   │   └── attend/route.ts        <-- API para atender individual o batch
│   │   ├── telegram/
│   │   │   ├── setup/route.ts         <-- Configuración automática del Webhook
│   │   │   └── webhook/route.ts       <-- Webhook del Bot (autenticado con /login, /seguimiento, /alertas)
│   │   ├── webhook/route.ts           <-- Webhook Meta WhatsApp / Instagram
│   │   ├── health/route.ts            <-- Diagnóstico general de servicios
│   │   ├── mcp/route.ts               <-- Servidor MCP con bloqueo de auth y tools/call
│   │   └── oauth/
│   │       └── authorize/route.ts     <-- Endpoint backend de validación de credenciales OAuth
│   ├── oauth/
│   │   ├── authorize/page.tsx         <-- Pantalla web de login OAuth con botón de ojo 👁️
│   │   └── token/route.ts             <-- Endpoint OAuth 2.0 para canjear code por access_token
│   ├── layout.tsx                     <-- Layout principal
│   └── page.tsx                       <-- Dashboard con interruptores de Seguimiento y Alertas
├── components/
│   ├── LoginForm.tsx                  <-- Pantalla de login previo con toggle de ojo 👁️
│   ├── UserManagementModal.tsx        <-- Panel modal de gestión de usuarios y roles dinámicos
│   ├── Navbar.tsx                     <-- Header con controles independientes de Seguimiento y Alertas
│   ├── KpiCards.tsx                   <-- Tarjetas de métricas superiores
│   ├── ReportsView.tsx                <-- Tablas interactivas y exportación Excel (.xlsx)
│   └── TrafficChat.tsx                <-- Drawer conversacional con tarjetas ejecutivas
├── lib/
│   ├── db.ts                          <-- Pool MariaDB/MySQL Hostinger, RBAC, configuración y auditoría
│   ├── monitoring-engine.ts           <-- Motor periódico inteligente (seguimiento + alertas críticas)
│   ├── controlt-service.ts            <-- Cliente API ControlT con OAuth y authenticateUser()
│   ├── format-utils.ts                <-- Parser antirrotura de tablas a tarjetas ejecutivas
│   ├── report-generator.ts            <-- Generador de reportes tabulares y paginación rápida
│   ├── ai-service.ts                  <-- Servicio OpenAI/Gemini con Function Calling
│   ├── telegram-service.ts            <-- Envío de mensajes, documentos y broadcast sanitizado
│   ├── data-store.ts                  <-- Almacén singleton en memoria / sincronizador
│   └── traffic-agent.ts               <-- Orquestador de intenciones y acciones
├── mcp/
│   └── server.ts                      <-- Servidor MCP Stdio para clientes locales
├── GUIA_EXTRACCION_APIS_CONTROLT_NOTEBOOKLM.md <-- Guía pedagógica para Google NotebookLM
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
  - *Soporte JWT Extenso:* Los tokens Bearer JWT de ControlT (~700 caracteres) se validan contra la columna `token_controlt` (TEXT) y por inspección en memoria de su vigencia y estado en `usuarios_controlt_registro`.
  - *Live API:* Las herramientas MCP `controlt_get_eta_summary` y `controlt_get_active_alarms` consultan en tiempo real los 160+ viajes y alarmas de la API de ControlT.

---

## 6. Módulo de Gestión de Usuarios y Roles (Exclusivo Administrador Principal)

- **Administrador Maestro:** `ggomez@elogia.com.co` (rol `ADMIN`).
- **Registro Automático de Primer Ingreso:** La tabla `usuarios_controlt_registro` almacena automáticamente a cualquier operador que inicie sesión por primera vez por cualquiera de los canales autorizados.
- **Activación / Desactivación:** El administrador puede alternar en tiempo real el estado (`ACTIVO` / `INACTIVO`).
- **Cierre Inmediato de Sesiones:** Al marcar a un operador como `INACTIVO`, se ejecuta una invalidación inmediata en `usuarios_controlt_sesiones` (`activo = 0`).
- **Bloqueo Omnicanal de Inactivos:** Si un operador en estado `INACTIVO` intenta ingresar por la web, interactuar en Telegram o WhatsApp, o consultar el servidor MCP / OAuth, el sistema bloquea la acción con:
  > *"❌ Tu usuario se encuentra inactivo en la plataforma. Comunícate con el administrador (ggomez@elogia.com.co) para solicitar activación."*
- **Inmunidad del Administrador Principal:** Protegido contra desactivación a nivel de base de datos e interfaz gráfica.
