# CONTEXTO DEL PROYECTO Y GUÍA TÉCNICA PARA IA (PROJECT CONTEXT)

> **Documento maestro de arquitectura, reglas de negocio y diseño operativo para el sistema Auto_trafico-CT.**  
> Diseñado para que cualquier agente de inteligencia artificial o desarrollador pueda comprender inmediatamente el contexto, flujo de datos, integración con ControlT y roadmap de la solución.

---

## 1. Visión y Propósito del Proyecto

**Auto_trafico-CT** es una solución de automatización y torre de control asistida por inteligencia artificial diseñada para interactuar con la plataforma logística **ControlT** (`https://tower.controlt.com.co`).

### Objetivos:
1. **Monitoreo Continuo y Clasificación:** Analizar viajes activos (conteo típico de ~161 unidades) y cruzar el estado del **Semáforo ETA** (A tiempo, Tarde, Tolerancia) con las **Alarmas por atender** (Crítica, Alta, Media, Baja).
2. **Atención Desatendida / Agente Autónomo:** Atender de forma automática o en lote las alarmas rutinarias (como *LLAMADA DE SEGUIMIENTO*) para aquellos vehículos que se encuentran en estado **A tiempo**, consultando su último evento y registrando la novedad en ControlT sin demora humana.
3. **Escalamiento y Alerta Humana:** Identificar y priorizar de inmediato las unidades con retraso (**TARDE**) o alarmas de seguridad (**CRÍTICA** como *FUERA DE RUTA*) para que el equipo operativo intervenga telefónicamente.
4. **Agente Conversacional Omnicanal:** Permitir al usuario dar instrucciones en texto libre tanto en la interfaz web de la aplicación (desplegada en Vercel) como a través de mensajería instantánea (**WhatsApp Cloud API** e **Instagram Messaging**).

---

## 2. Dominio Logístico y Plataforma ControlT

ControlT es el software de monitoreo de transporte y telemetría de flotas líder en Colombia. La arquitectura de ControlT cuenta con dos vistas operativas fundamentales:

### A. Vista Resumen (`https://tower.controlt.com.co/home/summary`)
Muestra la lista de viajes activos con telemetría en tiempo real:
- **N° de Viaje:** Identificador numérico de 10 dígitos (ej. `0101226422`).
- **Placa:** Matrícula del vehículo de carga (ej. `KNL064`).
- **Conductor:** Nombre y datos de contacto telefónico.
- **Cliente:** Empresa generadora de la carga (ej. Primax, Terpel, Nestlé, Quala, etc.).
- **Semáforo ETA:** Estado proyectado de cumplimiento de la cita:
  - 🟢 **`A_TIEMPO` (`stateNextPoint1`):** La hora estimada de llegada (ETA) cumple o anticipa la cita programada con el cliente.
  - 🔴 **`TARDE` (`stateNextPoint3`):** El vehículo llegará después de la cita pactada.
  - 🟡 **`TOLERANCIA` (`stateNextPoint2`):** Margen de tolerancia aceptable.
  - ⚪ **`SIN_CALCULO`:*** Sin telemetría suficiente para proyección.
- **Último Evento:** Registro del evento de telemetría más reciente (ej: `"Salida localidad cliente - PRIMAX COLOMBIA S.A. - 11/06/2026 09:27:47"` o `"Salida de zona prohibida Cuatro Vientos"`).
- **Novedad en Resumen:** Novedad operativa asociada al viaje (ej: `"En ruta sin novedad alguna"`).
- **Velocidad y Ubicación:** Telemetría GPS en km/h y georreferencia municipal.

### B. Vista Alarmas por Atender (`https://tower.controlt.com.co/home/alarmstoattend`)
Cola de eventos que requieren gestión y registro de novedades por parte de los operadores de tráfico.
- **Niveles de Prioridad:**
  - 🔴 **Crítica:** Máxima severidad (ej. `FUERA DE RUTA`, botón de pánico, desenganche).
  - 🟠 **Alta:** Eventos operativos prioritarios (ej. `LLAMADA DE SEGUIMIENTO`, `DEMORA EN RUTA - Cita cargue`, `SALIDA DEL DESTINATARIO`).
  - 🟡 **Media** y 🟢 **Baja:** Eventos informativos o `PROXIMIDAD DE DESTINO`.
- **Formulario de Atención (Modal con doble clic):**
  - Selector de **Novedad** (catálogo estándar de ControlT).
  - Campo de **Observaciones / Comentario** (obligatorio, hasta 450 caracteres).
  - Botón de guardado: **"AGREGAR NOVEDAD"**.

---

## 3. Protocolo Estándar de Atención de Alarmas (Flujo de 6 Pasos)

Validado y verificado en vivo sobre casos reales (`KNL064`, `TFR044`):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Consulta en Resumen: Capturar "Último evento"            │
│    (Extraer texto del evento, velocidad y ubicación).       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Navegación a Alarmas: Localizar la alarma por N° Viaje   │
│    Abrir con doble clic en la fila de la tabla.             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Mapeo Semántico: Relacionar último evento con catálogo   │
│    (Ej: Salida cliente / Salida zona -> "En ruta sin        │
│     novedad alguna").                                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Selección en el Formulario: Asignar la novedad mapeada.  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Redacción de Comentario Técnico:                         │
│    "Vehículo en tránsito a {V} km/h tras {Evento}. Continúa  │
│     en ruta sin novedad alguna."                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Guardado y Cierre: Clic en "AGREGAR NOVEDAD".            │
│    La alarma queda resuelta y se retira de la cola activa.  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitectura de Software de la Aplicación

El proyecto está construido como una aplicación full-stack monolítica moderna lista para **Vercel**:

```
Auto_trafico-CT/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          <-- Endpoint del Agente Conversacional (recibe texto libre)
│   │   ├── controlt/
│   │   │   ├── summary/route.ts   <-- API de Semáforo ETA y métricas
│   │   │   ├── alarms/route.ts    <-- API de Alarmas activas
│   │   │   └── attend/route.ts    <-- API para atender alarma individual o lote
│   │   └── webhook/route.ts       <-- Webhook Meta (WhatsApp Cloud API / Instagram)
│   ├── layout.tsx                 <-- Layout con diseño responsive
│   ├── page.tsx                   <-- Dashboard principal con KPIs y controles
│   └── globals.css                <-- Tailwind directives y estilos
├── components/
│   ├── Navbar.tsx                 <-- Header con estado de conexión y switch de Piloto Automático
│   ├── KpiCards.tsx               <-- Tarjetas de métricas superiores
│   ├── ReportsView.tsx            <-- Tabla multipestaña de reportes y exportación a Excel
│   └── TrafficChat.tsx            <-- Drawer conversacional con chips de sugerencia
├── lib/
│   ├── data-store.ts              <-- Almacén singleton con datos sincronizados de ControlT
│   └── traffic-agent.ts           <-- Motor de lenguaje natural, clasificación y tool execution
├── types/
│   └── index.ts                   <-- Definiciones de TypeScript para Viajes, Alarmas, Métricas
└── docs/
    └── reportes_especificacion.md <-- Especificación detallada de reportes
```

---

## 5. Endpoints de la API y Especificaciones

### `POST /api/chat`
Recibe texto libre del operador y ejecuta acciones sobre ControlT:
- **Request Body:** `{ "message": "Atiende las alarmas de los viajes a tiempo" }`
- **Response:**
  ```json
  {
    "success": true,
    "message": {
      "id": "msg-12345",
      "sender": "agent",
      "text": "Operación completada con éxito. He atendido 14 alarmas...",
      "timestamp": "11:30:00",
      "actionTaken": {
        "type": "ATTEND_BATCH",
        "summary": "Se atendieron 14 alarmas automáticamente"
      }
    }
  }
  ```

### `POST /api/controlt/attend`
Atiende alarmas específicas o ejecuta el proceso en lote:
- **Individual:** `{ "alarmaId": "8329496", "novedad": "En ruta sin novedad alguna", "comentario": "..." }`
- **Lote:** `{ "mode": "BATCH_ON_TIME" }`

### `GET /api/webhook` y `POST /api/webhook`
- **GET:** Verifica el handshake de Meta con `hub.mode=subscribe` y `hub.verify_token`.
- **POST:** Recibe el payload de WhatsApp / Instagram, extrae el texto del mensaje y lo procesa a través del `trafficAgent`.

---

## 6. Guía para Futuras IAs o Desarrolladores

Si estás continuando o extendiendo este proyecto:
1. **Para conectar credenciales reales de ControlT:** Configura las variables de entorno en `.env.local` (`CONTROLT_API_URL`, `CONTROLT_TOKEN`). El servicio en `lib/controlt-service.ts` o `lib/data-store.ts` puede reemplazar los mocks estáticos haciendo llamadas `fetch` a la API REST de ControlT.
2. **Para conectar WhatsApp / Instagram:** Registra la URL `https://tu-dominio.vercel.app/api/webhook` en la consola de Meta Developers (WhatsApp Cloud API) y usa el Verify Token configurado.
3. **Para añadir nuevas reglas de negocio de novedades:** Edita la matriz de mapeo en `.gemini/rules/controlt_traffic_flow.md` y en `lib/traffic-agent.ts`.
4. **Para compilar:** Corre `npm run build` o `npm run dev`. El código está estrictamente tipado en TypeScript.
