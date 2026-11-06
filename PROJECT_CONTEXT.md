# CONTEXTO DEL PROYECTO Y GUÍA TÉCNICA PARA IA (PROJECT CONTEXT)

> **Documento maestro de arquitectura, reglas de negocio y diseño operativo para el sistema Auto_trafico-CT.**  
> Diseñado para que cualquier agente de inteligencia artificial o desarrollador pueda comprender inmediatamente el contexto, flujo de datos, integración con ControlT, Telegram, Base de Datos (Supabase) y Servidor MCP.

---

## 1. Visión y Propósito del Proyecto

**Auto_trafico-CT** es una solución de automatización y torre de control asistida por inteligencia artificial diseñada para interactuar con la plataforma logística **ControlT** (`https://tower.controlt.com.co`).

### Capacidades del Sistema:
1. **Monitoreo Continuo y Clasificación:** Analizar viajes activos (~161 unidades) y cruzar el estado del **Semáforo ETA** (A tiempo, Tarde, Tolerancia) con las **Alarmas por atender** (Crítica, Alta, Media, Baja).
2. **Atención Desatendida / Agente Autónomo:** Atender automáticamente las alarmas rutinarias (*LLAMADA DE SEGUIMIENTO*) para vehículos en estado **A tiempo**, consultando su último evento y registrando la novedad en ControlT sin demora humana.
3. **Escalamiento y Alerta Humana:** Identificar y priorizar de inmediato las unidades con retraso (**TARDE**) o alarmas de seguridad (**CRÍTICA** como *FUERA DE RUTA*) para que el equipo operativo intervenga telefónicamente.
4. **Agente Conversacional Omnicanal (Telegram & Web):** Permitir al usuario dar órdenes en texto libre tanto en la interfaz web de la aplicación (desplegada en Vercel) como a través de un **Bot de Telegram**.
5. **Servidor MCP (Model Context Protocol):** Exponer herramientas estandarizadas para que cualquier IA (Claude Desktop, Cursor, Antigravity) pueda monitorear y atender ControlT.
6. **Persistencia y Auditoría en Base de Datos (Supabase / PostgreSQL):** Registro inmutable de cada acción ejecutada, trazabilidad de quién y cuándo se atendió cada alarma.

---

## 2. Dominio Logístico y Plataforma ControlT

### A. Vista Resumen (`/home/summary`)
- **N° de Viaje:** 10 dígitos (ej. `0101226422`).
- **Placa:** Matrícula del vehículo de carga (ej. `KNL064`).
- **Semáforo ETA:**
  - 🟢 **`A_TIEMPO` (`stateNextPoint1`):** Cumple o anticipa la cita del cliente (72% de la flota).
  - 🔴 **`TARDE` (`stateNextPoint3`):** Llegará después de la cita (24.2% de la flota).
  - 🟡 **`TOLERANCIA` (`stateNextPoint2`):** Margen aceptable (1.9%).
  - ⚪ **`SIN_CALCULO`:*** Telemetría insuficiente (1.9%).
- **Último Evento:** Registro del evento GPS más reciente.

### B. Vista Alarmas por Atender (`/home/alarmstoattend`)
- **Niveles de Prioridad:**
  - 🔴 **Crítica:** Máxima severidad (ej. `FUERA DE RUTA`, pánico).
  - 🟠 **Alta:** Prioritarios de seguimiento (ej. `LLAMADA DE SEGUIMIENTO`, demoras de cargue).
  - 🟡 **Media** y 🟢 **Baja:** Eventos informativos o `PROXIMIDAD DE DESTINO`.
- **Formulario de Atención (Modal):** Selector de Novedad, campo de comentario (obligatorio) y botón *"AGREGAR NOVEDAD"*.

---

## 3. Protocolo Estándar de Atención de Alarmas (6 Pasos)

Validado y verificado en vivo sobre casos reales (`KNL064`, `TFR044`):
1. **Consulta en Resumen:** Capturar *Último evento*, velocidad y ubicación.
2. **Navegación a Alarmas:** Localizar alarma por N° Viaje y abrir con doble clic.
3. **Mapeo Semántico:** Relacionar último evento con el catálogo de novedades de ControlT (*Salida cliente / zona* $\rightarrow$ *"En ruta sin novedad alguna"*).
4. **Selección en el Formulario:** Asignar la novedad seleccionada.
5. **Redacción de Comentario:** *"Vehículo en tránsito a {V} km/h tras {Evento}. Continúa en ruta sin novedad alguna."*
6. **Guardado:** Clic en *"AGREGAR NOVEDAD"*.

---

## 4. Arquitectura de Software

```
Auto_trafico-CT/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              <-- Endpoint conversacional IA (texto libre web)
│   │   ├── controlt/
│   │   │   ├── summary/route.ts       <-- API de Semáforo ETA y viajes
│   │   │   ├── alarms/route.ts        <-- API de Alarmas activas
│   │   │   └── attend/route.ts        <-- API para atender individual o batch
│   │   ├── telegram/webhook/route.ts  <-- Webhook del Bot de Telegram (recibe mensajes y clics)
│   │   └── mcp/route.ts               <-- Endpoint HTTP JSON-RPC para MCP
│   ├── layout.tsx                     <-- Layout principal
│   └── page.tsx                       <-- Dashboard interactivo con KPIs y Chat
├── components/
│   ├── Navbar.tsx                     <-- Header con botón de Piloto Automático
│   ├── KpiCards.tsx                   <-- Tarjetas de métricas superiores
│   ├── ReportsView.tsx                <-- Tablas interactivas y exportación Excel (.xlsx)
│   └── TrafficChat.tsx                <-- Drawer conversacional con chips rápidos
├── database/
│   └── schema.sql                     <-- Schema DDL completo para Supabase/PostgreSQL
├── lib/
│   ├── db.ts                          <-- Cliente de Supabase y registro de auditoría
│   ├── telegram-service.ts            <-- Servicio de mensajería Telegram Bot API
│   ├── data-store.ts                  <-- Almacén singleton en memoria / sincronizador
│   └── traffic-agent.ts               <-- Motor de lenguaje natural y ejecución de tools
├── mcp/
│   └── server.ts                      <-- Servidor MCP Stdio para Claude Desktop y Antigravity
└── types/
    └── index.ts                       <-- Definiciones TypeScript
```

---

## 5. Base de Datos (Supabase / PostgreSQL)

Diseñada en `database/schema.sql` con 5 tablas principales:
1. `viajes`: Estado, cliente, citas y semáforo ETA.
2. `alarmas`: Cola de eventos pendientes y severidades.
3. `atenciones_auditoria`: Registro histórico inmutable de atenciones (quién, cuándo, qué novedad, canal de origen: WEB, TELEGRAM, MCP).
4. `reglas_mapeo_novedades`: Matriz configurable de mapeo entre eventos y novedades.
5. `telegram_usuarios_autorizados`: Control de acceso y roles de operadores en Telegram.

---

## 6. Servidor MCP (Model Context Protocol)

Permite que agentes externos invoquen herramientas nativas:
- `controlt_get_eta_summary`
- `controlt_get_active_alarms`
- `controlt_attend_alarm`
- `controlt_batch_attend_on_time`

---

## 7. Instrucciones para Continuar el Desarrollo

1. **Para levantar en local:** `npm run dev` en el puerto 3000.
2. **Para probar el bot de Telegram:** Colocar `TELEGRAM_BOT_TOKEN` en `.env.local` y registrar el webhook apuntando a `/api/telegram/webhook`.
3. **Para conectar Supabase:** Ejecutar `database/schema.sql` en el SQL Editor de tu proyecto de Supabase y configurar `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
4. **Para desplegar:** Push a GitHub y despliegue automático en Vercel.
