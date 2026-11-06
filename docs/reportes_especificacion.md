# Especificación de Reportes del Sistema - Torre de Control ControlT

Este documento define la estructura, métricas y especificaciones técnicas de los reportes analíticos y operativos requeridos para la aplicación Node.js / Vercel.

---

## 1. Módulos de Reporte Principales

- **Reporte 1: Estado del Semáforo ETA (Cumplimiento de Citas)**
  - Puntualidad de la flota: A Tiempo (🟢), Tolerancia (🟡), Tarde (🔴) y Sin cálculo (⚪).
  - Listado con: N° Viaje, Placa, Conductor, Teléfono, Cliente, Origen, Destino, Cita Programada, ETA calculada, Desviación (+/- min) y % Ruta.

- **Reporte 2: Alarmas por Nivel de Prioridad (Crítica, Alta, Baja)**
  - Distribución por severidad: Críticas (pánicos, fuera de ruta), Altas (demoras, citas próximas, llamadas de seguimiento), Bajas (proximidad).
  - Telemetría en tiempo real: Velocidad (km/h) > 0 vs = 0, Ubicación GPS, Último evento en resumen y tiempo de espera sin atención.

- **Reporte 3: Matriz de Riesgo y Operación Autónoma (Cruce Inteligente)**
  - Segregación inteligente:
    - **Procesables por el Agente IA:** Viajes a tiempo + Llamada de seguimiento + Velocidad normal.
    - **Escalables a Operador Humano:** Viajes tarde o alarmas críticas que requieren llamada telefónica directa.

- **Reporte 4: Historial y Auditoría de Atenciones**
  - Registro de todas las atenciones ejecutadas: ID Alarma, Viaje, Novedad seleccionada, Comentario registrado, Timestamp y Usuario/Agente que atendió.

---

## 2. Capacidades de Exportación

- **Excel (.xlsx):** Libro consolidado con pestañas dedicadas.
- **CSV / JSON API:** Endpoints listos para descarga o integración con PowerBI / sistemas externos.
- **Visualización en UI:** Gráficos de dona de puntualidad y tarjetas KPI en tiempo real.

