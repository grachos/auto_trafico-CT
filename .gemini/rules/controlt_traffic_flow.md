# Protocolo de Operación Torre de Control ControlT (Auto_trafico-CT)

Este protocolo define las reglas de negocio y el procedimiento estándar para la atención autónoma de alarmas en la plataforma ControlT Torre de Control (`https://tower.controlt.com.co`).

---

## 1. Criterios de Selección y Priorización de Viajes

Para atender alarmas de manera masiva o desatendida, se aplican los siguientes filtros en orden:

1. **Estado Semáforo ETA:**
   - Solo se gestionan automáticamente alarmas de viajes cuyo semáforo ETA se encuentre en estado **🟢 A TIEMPO** (`stateNextPoint1`).
   - Viajes en estado **🔴 TARDE** o **🟡 TOLERANCIA** requieren validación manual o seguimiento especial de demoras.

2. **Tipo de Alarma / Evento:**
   - Evento principal a gestionar: **`LLAMADA DE SEGUIMIENTO`**.
   - Prioridad de atención: **ALTA** primero, luego **BAJA**.

3. **Telemetría y Estado de Movimiento:**
   - **Velocidad > 0 km/h:** Vehículo en ruta activa. Si el último evento es normal, se atiende como "En ruta sin novedad alguna" o conductor al volante.
   - **Velocidad = 0 km/h:** Vehículo detenido. Validar si está en geocerca cliente (cargue/descargue), zona de pernocta o parada técnica.

---

## 2. Flujo Operativo Estándar (6 Pasos)

Para cada viaje seleccionado que cumpla los criterios:

```
[1. Resumen: Capturar Último Evento] 
         │
         ▼
[2. Alarmas por Atender: Doble Clic en Alarma]
         │
         ▼
[3. Mapeo de Novedad según Último Evento]
         │
         ▼
[4. Selección de Novedad en Formulario]
         │
         ▼
[5. Redacción de Comentario Coherente]
         │
         ▼
[6. Guardar: Clic en "AGREGAR NOVEDAD"]
```

### Detalle de cada paso:
1. **Consulta en Resumen (`/home/summary`):**
   - Buscar el viaje por ID o placa.
   - Extraer: `Último evento`, `Novedad asociada`, `Velocidad (km/h)`, `Ubicación` y `Estado del viaje`.
2. **Apertura de Alarma (`/home/alarmstoattend`):**
   - Localizar el registro correspondiente al viaje y evento `LLAMADA DE SEGUIMIENTO`.
   - Abrir el modal de atención con doble clic en la fila.
3. **Mapeo de la Novedad:**
   - Buscar en el desplegable de opciones la novedad equivalente o idéntica a la reflejada en el resumen.
4. **Selección:**
   - Asignar la opción seleccionada en el formulario.
5. **Observación / Comentario:**
   - Redactar un texto profesional indicando estado actual, velocidad, referencia del último evento y condición de tránsito normal.
   - *Ejemplo:* `"Vehículo en tránsito a 68 km/h tras salida de zona prohibida. Continúa en ruta sin novedad alguna."`
6. **Confirmación:**
   - Pulsar el botón **"AGREGAR NOVEDAD"** para cerrar la alarma y refrescar la cola.

---

## 3. Matriz de Mapeo de Novedades

| Último Evento en Resumen | Novedad a Seleccionar en Alarma | Comentario Sugerido |
|---|---|---|
| *Salida localidad cliente* | `En ruta sin novedad alguna` | "Vehículo en tránsito tras salida de localidad cliente. Continúa en ruta sin novedad alguna." |
| *Salida de zona prohibida / alerta* | `En ruta sin novedad alguna` | "Vehículo en tránsito a {velocidad} km/h tras salida de zona controlada. Continúa en ruta normal." |
| *En ruta normal / Transito* | `En ruta sin novedad alguna` | "Vehículo en movimiento a {velocidad} km/h. Ruta sin novedad." |
| *Ingreso a localidad destino* | `En localidad destino / Cliente` | "Vehículo en proximidad o ingreso a localidad destino. En proceso logístico." |
| *Vehículo detenido en ruta* | `Parada técnica / Descanso` | "Vehículo reporta 0 km/h en zona autorizada. En seguimiento." |

