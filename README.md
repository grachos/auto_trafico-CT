# Torre de Control ControlT - Agente Autónomo de Tráfico 🚛🤖

Aplicación web moderna desarrollada en **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, diseñada para desplegarse en **Vercel** y conectarse con la plataforma **ControlT** (`https://tower.controlt.com.co`).

---

## 🌟 Características Principales

### 1. Motor de Agente IA con Texto Libre
- **Chat Conversacional Inteligente:** Permite dar órdenes en lenguaje natural en español:
  - *"Atiende las alarmas de los viajes a tiempo"*
  - *"Dame el reporte de semáforo ETA"*
  - *"¿Cuáles son las alarmas críticas activas?"*
  - *"Atiende la alarma del viaje 0101226621"*
- **Acciones Reales en ControlT:** El agente analiza el último evento de cada viaje en la vista de Resumen, determina la novedad correcta (*"En ruta sin novedad alguna"*), redacta la observación y confirma el cierre mediante *AGREGAR NOVEDAD*.

### 2. Reportes Operativos en Tiempo Real
- **Reporte Semáforo ETA:**
  - Desglose porcentual y cuantitativo: 🟢 A tiempo (72%), 🔴 Con retraso (24.2%), 🟡 Tolerancia y ⚪ Sin cálculo.
  - Tabla detallada con cita pactada, ETA calculada por telemetría GPS, conductor y avance de ruta.
- **Reporte de Alarmas por Nivel de Prioridad:**
  - 🔴 **Críticas:** Fuera de ruta, botón de pánico.
  - 🟠 **Altas:** Demoras de cita, llamadas de seguimiento en ruta.
  - 🟡 **Medias** y 🟢 **Bajas**.
- **Matriz de Riesgo Operativo:**
  - Segregación inteligente: casos atendibles automáticamente por IA vs. casos con retraso que requieren intervención telefónica humana directa.
- **Exportación Consolidada a Excel (.xlsx):**
  - Descarga directa de todas las hojas en un solo archivo para gerencia y auditoría.

### 3. Omnicanalidad (WhatsApp e Instagram Ready)
- El endpoint `/api/webhook` está listo para recibir mensajes desde **Meta Cloud API** (WhatsApp Business / Instagram Messaging) con handshake de verificación y procesamiento automático de órdenes.

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

3. Abrir en el navegador:
```
http://localhost:3000
```

---

## ☁️ Despliegue en Vercel

### Opción 1: Mediante Vercel CLI
```bash
npx vercel
```

### Opción 2: Conexión con GitHub
1. Sube este repositorio a GitHub.
2. Ingresa a [vercel.com](https://vercel.com) e importa el proyecto.
3. Configura las variables de entorno opcionales en el panel de Vercel Settings:
   - `CONTROLT_API_URL`
   - `CONTROLT_TOKEN`
   - `GEMINI_API_KEY`
   - `WEBHOOK_VERIFY_TOKEN`
4. Haz clic en **Deploy**. ¡Listo en menos de 2 minutos!

---

## 📱 Conexión con WhatsApp / Instagram

1. En el portal de desarrolladores de Meta (WhatsApp Cloud API o Instagram Graph API):
   - **Callback URL:** `https://tu-proyecto.vercel.app/api/webhook`
   - **Verify Token:** El configurado en `WEBHOOK_VERIFY_TOKEN` (por defecto: `token_seguro_para_meta_webhooks`).
2. Suscríbete al webhook de `messages`.
3. Cualquier mensaje de texto enviado al número de WhatsApp o cuenta de Instagram será procesado por el Agente de Tráfico y responderá en el mismo hilo.

---

## 📁 Estructura del Proyecto

```
Auto_trafico-CT/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Endpoint conversacional con la IA
│   │   ├── controlt/
│   │   │   ├── alarms/route.ts    # Listado de alarmas activas
│   │   │   ├── attend/route.ts    # Atención individual y batch
│   │   │   └── summary/route.ts   # Reporte Semáforo ETA
│   │   └── webhook/route.ts       # Webhook WhatsApp / Instagram
│   ├── globals.css                # Estilos globales y Tailwind
│   ├── layout.tsx                 # Layout principal
│   └── page.tsx                   # Dashboard interactivo
├── components/
│   ├── Navbar.tsx                 # Barra superior y control de piloto automático
│   ├── KpiCards.tsx               # Tarjetas KPI de resumen
│   ├── ReportsView.tsx            # Tablas interactivas y exportación Excel
│   └── TrafficChat.tsx            # Drawer del Agente IA en texto libre
├── lib/
│   ├── data-store.ts              # Almacén de datos sincronizado con ControlT
│   └── traffic-agent.ts           # Lógica conversacional y motor de acciones
├── types/
│   └── index.ts                   # Interfaces TypeScript
└── docs/
    └── reportes_especificacion.md # Especificación técnica de reportes
```

