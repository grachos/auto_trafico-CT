# 📘 GUÍA MAESTRA: CÓMO EXTRAER INFORMACIÓN Y CONECTARSE A LAS APIS DE CONTROLT
> **Documento de Aprendizaje y Referencia para Google NotebookLM**  
> *Diseñado para generar Podcasts de Audio, Guiones de Video, Infografías Conceptuales y Tarjetas de Estudio (Flashcards).*  
> **Autor:** Elogia Soluciones Logísticas — Plataforma ToCIE (Torre de Control Inteligente Elogia)

---

## 🎯 1. INTRODUCCIÓN "PARA DUMMIES": ¿QUÉ ES CONTROLT Y QUÉ ES UNA API?

### La Analogía del Restaurante
Imagina que vas a almorzar a un restaurante:
* **La Cocina:** Es la base de datos de **ControlT** (`tower.controlt.com.co`), donde están cocinándose en tiempo real las posiciones GPS de 170 camiones, las horas de llegada, los clientes (Nestlé, Primax, Terpel) y las alarmas de tráfico.
* **Tú (El Cliente):** Eres tú o tu aplicación (**ToCIE**), que necesita saber si el camión `PPQ455` va a tiempo. Tú no puedes entrar directamente a la cocina a meter la mano en las ollas.
* **El Mesero:** Es la **API** (*Application Programming Interface*). Tú le entregas al mesero una orden escrita en una servilleta (una petición o *Request*), el mesero va a la cocina, busca el plato y te lo trae listo a tu mesa en una bandeja limpia (una respuesta en formato *JSON*).

### ¿Por qué automatizamos esto?
En un día normal, un operador humano tendría que hacer clic cientos de veces en la pantalla de ControlT para ver qué camión va tarde o para cerrar llamadas de seguimiento. Al conectarnos directamente por la API, un programa inteligente puede revisar los 170 camiones en **1 segundo** sin cansarse jamás.

---

## 🏰 2. LA ARQUITECTURA: LAS DOS PUERTAS DE CONTROLT

ControlT no tiene un solo servidor, sino **dos puertas separadas** que cumplen funciones diferentes:

```
+-------------------------------------------------------------+
|                     PUERTA 1: RECEPCIÓN                     |
|           POST https://app.controlt.com.co/                 |
|             apipublic/api/login/oauth                       |
|  (Aquí entregas tu usuario y contraseña y te dan la llave)  |
+-------------------------------------------------------------+
                              |
                     Te entrega un TOKEN
                              |
                              v
+-------------------------------------------------------------+
|                  PUERTA 2: TORRE OPERATIVA                  |
|            GET/POST https://tower-api.controlt.com.co       |
|    (Aquí muestras tu llave para consultar y cerrar alarmas) |
+-------------------------------------------------------------+
```

### La Analogía del Hotel Todo Incluido
1. **La Recepción (Puerta 1):** Llegas al hotel, muestras tu cédula y te ponen en la muñeca una **manilla VIP** (el *Access Token*).
2. **Las Habitaciones y el Restaurante (Puerta 2):** En la piscina o el restaurante ya no te piden la cédula; solo muestras la manilla VIP y te abren las puertas.

---

## 🔑 3. PASO 1: CÓMO OBTENER LA LLAVE MAESTRA (LOGIN OAUTH)

Para hablar con ControlT, lo primero es identificarse ante el servicio de seguridad.

### Datos de la Petición:
* **Método:** `POST`
* **URL:** `https://app.controlt.com.co/apipublic/api/login/oauth`
* **Encabezados (Headers):**
  - `Content-Type: application/json`
  - `Accept: application/json`
* **Cuerpo (Body JSON):**
```json
{
  "username": "tu_usuario@elogia.com.co",
  "password": "TuContraseñaSegura123"
}
```

### Lo que responde ControlT (El Tesoro):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0...",
  "token_type": "bearer",
  "expires_in": 3600,
  "userName": "GRAZIANY GOMEZ",
  "idCompany": "616346"
}
```

### Conceptos Clave:
1. **`access_token` (Token Bearer / JWT):** Es una cadena larga de texto cifrado (~700 caracteres). Es tu credencial digital. Quien tenga este token tiene autorización para consultar la flota.
2. **`expires_in: 3600`:** Significa que la llave vence en **1 hora** (3600 segundos). El sistema inteligente renueva automáticamente la llave antes de que expire.
3. **`idCompany: 616346`:** Es el código identificador de tu empresa (Elogia) dentro de ControlT.

---

## 🎩 4. PASO 2: LAS 5 REGLAS DE ETIQUETA (HEADERS OBLIGATORIOS)

Una vez tienes el `access_token`, cualquier consulta operativa a la Torre (`tower-api.controlt.com.co`) **DEBE** incluir 5 encabezados obligatorios. Si olvidas uno solo, el servidor te rechazará con error `401 Unauthorized`.

| Encabezado | Valor de Ejemplo | ¿Para qué sirve? |
| :--- | :--- | :--- |
| **`Authorization`** | `Bearer eyJhbGciOi...` | Muestra tu manilla VIP al vigilante de la puerta. |
| **`id-company`** | `616346` | Le indica a ControlT de qué empresa quieres ver los camiones. |
| **`time-zone`** | `-05:00` | Fija la zona horaria de Colombia (evita desfases de horas). |
| **`Content-Type`** | `application/json` | Indica que estás hablando en idioma JSON estándar. |
| **`Accept`** | `application/json` | Le exige a ControlT que te responda en formato JSON limpio. |

---

## 📡 5. PASO 3: EXTRACCIÓN DE DATOS OPERATIVOS EN VIVO

Una vez autenticado, hay 4 consultas fundamentales que extraen el 100% de la operación:

---

### A. El Radar de Flota: Resumen de Viajes y Semáforo ETA
* **Objetivo:** Saber dónde está cada camión, si va a tiempo o si va retrasado para su cita.
* **Método:** `GET`
* **URL:** `https://tower-api.controlt.com.co/Home/resumeForUI?search=&size=200&page=1`
* **Campos Extraídos de Cada Camión:**
  - `license_plate`: Placa del vehículo (ej. `KNL064`).
  - `trip_number`: Número de viaje (ej. `0101226422`).
  - `driver_name`: Nombre del conductor.
  - `company_customer_name`: Cliente de la carga (ej. `PRIMAX COLOMBIA S.A.`, `NESTLÉ`).
  - `origin_city_name` ➔ `destiny_city_name`: Ruta (ej. `CARTAGENA` ➔ `BOGOTÁ`).
  - `speed`: Velocidad en tiempo real en km/h.
  - `current_address_location`: Dirección o vía GPS actual.
  - `last_event`: Último evento registrado (ej. `Salida localidad cliente`).

#### 🚦 El Secreto del Semáforo ETA (`state_next_point`):
ControlT califica la puntualidad de cada viaje con un código numérico:
* `1` ➔ 🟢 **A TIEMPO:** El camión llegará antes o exacto a la cita del cliente (~70% de la flota).
* `2` ➔ 🟡 **TOLERANCIA:** Margen aceptable de retraso (~2% de la flota).
* `3` ➔ 🔴 **TARDE / RETRASADO:** El camión no alcanzará la cita pactada (~25% de la flota). Requiere intervención humana.

---

### B. La Pizarra de Alarmas por Atender
* **Objetivo:** Ver qué vehículos tienen eventos pendientes que el cliente o el protocolo exigen gestionar.
* **Método:** `GET`
* **URL:** `https://tower-api.controlt.com.co/Home/alarms/attendForUI?search=&size=100&page=1`
* **Campos Extraídos:**
  - `id_monitoring_orders_alarm`: ID único de la alarma (ej. `8329496`).
  - `priority`: Severidad (`CRITICA`, `ALTA`, `MEDIA`, `BAJA`).
  - `alarm_name`: Nombre del evento (`LLAMADA DE SEGUIMIENTO`, `FUERA DE RUTA`, `ZONA PROHIBIDA`).

---

### C. Posición GPS Inmediata por Placa
* **Objetivo:** Consultar la ubicación satelital exacta de un camión en cualquier instante.
* **Método:** `GET`
* **URL:** `https://tower-api.controlt.com.co/Hub/CurrentPosition/{placa}` (ej. `.../Hub/CurrentPosition/KNL064`)
* **Devuelve:** Coordenadas de Latitud y Longitud, velocidad y rumbo para graficar en mapas como Google Maps o OpenStreetMap.

---

### D. Bitácora Histórica del Viaje
* **Objetivo:** Consultar la "caja negra" con todo lo que ha pasado desde que el camión cargó hasta ahora.
* **Método:** `GET`
* **URL:** `https://tower-api.controlt.com.co/MonitoringOrder/binnacle/{tripId}`
* **Devuelve:** Lista cronológica de todos los puestos de control pasados, llamadas realizadas y novedades reportadas.

---

## ⚡ 6. PASO 4: ACCIÓN OPERATIVA (CÓMO CERRAR ALARMAS EN CONTROLT)

Extraer datos es solo la mitad del trabajo; la otra mitad es **actuar sobre ControlT**.

Cuando un camión va **A TIEMPO**, el protocolo de transporte exige registrar una *"Llamada de seguimiento"* confirmando que todo marcha bien. Nuestro sistema autónomo lo hace mediante este endpoint:

* **Método:** `POST`
* **URL:** `https://tower-api.controlt.com.co/Alarms/attend/Save/Novelty`
* **Cuerpo (Body JSON):**
```json
{
  "idMonitoringOrdersAlarm": 8329496,
  "numberTrip": "0101226621",
  "licensePlate": "KUS253",
  "noveltySelected": 1,
  "codeNoveltySelected": "EN_RUTA",
  "comment": "Vehículo en tránsito normal a 52 km/h en Mamonal. Ruta sin novedad alguna.",
  "address": "Mamonal, Cartagena",
  "username": "ggomez@elogia.com.co",
  "idCompany": 616346,
  "timeZone": "-05:00"
}
```

### ¿Qué ocurre en ControlT al enviar esto?
1. La alarma `8329496` desaparece de la cola de pendientes.
2. En la bitácora del viaje queda grabado que a las 11:30 AM el operador reportó *"En ruta sin novedad alguna"*.
3. La auditoría legal y de aseguradora queda 100% blindada.

---

## 🔄 7. CÓMO SE INTEGRA TODO: EL CICLO VIRTUAL DE ToCIE

El sistema funciona como un ciclo perfecto cada **10 minutos**:

```
 ⏱️ 1. Hostinger Cron despierta cada 10 minutos
      │
      ▼
 🔑 2. ToCIE solicita o reutiliza el Token de ControlT
      │
      ▼
 📡 3. Descarga en tiempo real:
      ├── Resumen de 170 viajes
      └── Cola de alarmas activas
      │
      ▼
 🔀 4. BIFURCACIÓN INTELIGENTE (Dos Motores Separados):
      │
      ├── ⚡ MOTOR 1: Piloto de Seguimiento (Si está ACTIVO)
      │    └── ¿El viaje va A TIEMPO y tiene alarma de seguimiento?
      │         └── SÍ: Cierra la alarma en ControlT y audita en MySQL.
      │
      └── 🚨 MOTOR 2: Vigilancia Crítica de Seguridad (Siempre Activo)
           └── ¿El camión está FUERA DE RUTA, en ZONA PROHIBIDA o a >80 km/h?
                └── SÍ: Envía Alerta con Botón de Llamada a Telegram.
```

---

## 🎭 8. GUION PARA PODCAST / VIDEO EXPLICATIVO (2 PERSONAJES)

> **Personajes:**
> * **Alex:** El aprendiz curioso que hace las preguntas que todo principiante se hace.
> * **Sam:** La ingeniera experta de Elogia que explica de forma clara, amena y con metáforas cotidianas.

**[Música de inicio animada y moderna]**

**Alex:** ¡Hola a todos! Bienvenidos a este episodio especial. Hoy vamos a responder una duda que muchos en el sector transporte se hacen: ¿Cómo diablos hace un sistema de inteligencia artificial para conectarse a una plataforma gigantesca como ControlT y saber exactamente dónde están casi doscientos camiones al mismo tiempo?

**Sam:** ¡Hola Alex! La verdad parece magia negra, pero en realidad es pura arquitectura bien pensada. Imagínate que ControlT es como un aeropuerto internacional. Hay cientos de aviones moviéndose, horarios que cumplir y salas de control llenas de monitores. Para que nosotros, desde Elogia, podamos hablar con ese aeropuerto sin necesidad de tener a una persona pegada a la pantalla haciendo clics las veinticuatro horas, usamos lo que llamamos una **API**.

**Alex:** Espera, Sam. Para los que no somos ingenieros... ¿qué es exactamente una API en la vida real?

**Sam:** Piensa en un restaurante. Tú eres el cliente sentado en la mesa. La cocina de ControlT está llena de datos: placas, velocidades, alarmas. Tú no puedes entrar a la cocina a servirte. ¿Quién es el intermediario? ¡El mesero! La API es ese mesero incansable. Tú le entregas una orden escrita en formato JSON, el mesero va a la cocina de ControlT, busca el plato y te lo trae listo y caliente en medio segundo.

**Alex:** Me encanta la metáfora. Pero imagino que no cualquier persona puede pedirle datos al mesero. ¿Cómo sabe ControlT que somos nosotros y no un intruso?

**Sam:** Exacto, ahí entra el concepto del **Token Bearer**. Cuando nuestro sistema arranca, visita la "Recepción" de ControlT. Entrega un usuario y contraseña corporativos. ControlT verifica que somos de Elogia y nos entrega una **manilla VIP**: un código larguísimo llamado Token. A partir de ese momento, cada vez que le pedimos datos al mesero de la Torre de Control, le mostramos la manilla VIP. Esa manilla dura una hora y nuestro sistema la renueva automáticamente sin que nadie tenga que mover un dedo.

**Alex:** ¡Brillante! Y una vez que tenemos la manilla VIP puesta... ¿qué información le pedimos?

**Sam:** Le pedimos dos platos principales. El primero es el **Radar de Flota**: nos devuelve la lista completa de viajes activos, su ubicación GPS, la velocidad y algo vital llamado el **Semáforo ETA**. El semáforo nos dice en verde quién va a tiempo, y en rojo quién va retrasado para su cita con clientes como Primax o Nestlé.

**Alex:** ¿Y el segundo plato?

**Sam:** La **Pizarra de Alarmas**. ControlT genera eventos constantemente. Por ejemplo: "Llamada de seguimiento rutinaria". Si el camión va a tiempo y todo está en orden, nuestro copiloto inteligente toma la alarma, redacta el comentario protocolario y la cierra en ControlT en cero coma ocho segundos.

**Alex:** O sea que le quita a los operadores humanos cientos de horas de trabajo repetitivo frente a la pantalla.

**Sam:** Exactamente. Y deja a los supervisores humanos libres para enfocarse en lo que de verdad importa: si un camión se sale de la ruta trazada o entra en una zona prohibida, el sistema no lo cierra, sino que dispara de inmediato una alarma con botón de llamada directa a Telegram para que el equipo intervenga en el acto.

**Alex:** ¡Increíble! Así es como la tecnología y la logística de Elogia se unen para cuidar cada viaje. ¡Nos vemos en el próximo episodio!

**[Música de cierre]**

---

## 📊 9. INFOGRAFÍA CONCEPTUAL: FLUJO DE DATOS EN 4 PASOS

```
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 1: AUTENTICACIÓN (La Recepción)                                   │
│ [Usuario + Clave] ──────> POST /apipublic/api/login/oauth ──────> TOKEN│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Token Bearer válido por 1h)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 2: CONSULTA DE TELEMETRÍA (El Radar de ControlT)                  │
│ GET /Home/resumeForUI ──────────> 170 Camiones: GPS, Ruta y Semáforo   │
│ GET /Home/alarms/attendForUI ───> Cola de Alarmas Pendientes           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 3: ANÁLISIS DE DECISIÓN INTELIGENTE (El Cerebro ToCIE)            │
│                                                                        │
│ ¿Alarma Rutinaria + Camión a Tiempo?   ¿Fuera de Ruta o Zona Roja?     │
│             │                                       │                  │
│             ▼                                       ▼                  │
│   [Piloto de Seguimiento]                 [Alerta de Seguridad]        │
└─────────────┬───────────────────────────────────────┬──────────────────┘
              │                                       │
              ▼                                       ▼
┌───────────────────────────────┐       ┌────────────────────────────────┐
│ PASO 4A: ACCIÓN EN CONTROLT   │       │ PASO 4B: ACCIÓN HUMANA         │
│ POST /Alarms/attend/Save/...  │       │ Alerta inmediata a Telegram    │
│ • Asigna novedad "En ruta"    │       │ • Botón: [📞 Llamar Conductor] │
│ • Alarma cerrada en vivo      │       │ • Botón: [🗺️ Ver Google Maps] │
└───────────────────────────────┘       └────────────────────────────────┘
```

---

## 🗂️ 10. DIEZ TARJETAS DE ESTUDIO (FLASHCARDS PARA NOTEBOOKLM)

### Tarjeta 1
* **Pregunta:** ¿Cuál es la diferencia entre `app.controlt.com.co` y `tower-api.controlt.com.co`?
* **Respuesta:** `app.controlt.com.co` es el servidor de autenticación OAuth donde se entregan las credenciales para recibir el token. `tower-api.controlt.com.co` es el servidor operativo donde se consultan los viajes y se atienden las alarmas.

---

### Tarjeta 2
* **Pregunta:** ¿Qué es un Token Bearer y cuánto tiempo dura en ControlT?
* **Respuesta:** Es una llave criptográfica digital temporal (formato JWT de ~700 caracteres) que certifica la identidad del usuario. En ControlT tiene una vigencia de 3600 segundos (1 hora).

---

### Tarjeta 3
* **Pregunta:** ¿Qué significa el campo `state_next_point` en la consulta de viajes?
* **Respuesta:** Es el Semáforo ETA que califica la puntualidad del viaje frente a la cita del cliente: `1` es A Tiempo (verde), `2` es Tolerancia (amarillo) y `3` es Tarde / Retrasado (rojo).

---

### Tarjeta 4
* **Pregunta:** ¿Cuáles son los 5 encabezados (Headers) obligatorios para consultar la API de ControlT?
* **Respuesta:** 
  1. `Authorization: Bearer <TOKEN>`
  2. `id-company: <ID_EMPRESA>`
  3. `time-zone: -05:00`
  4. `Content-Type: application/json`
  5. `Accept: application/json`

---

### Tarjeta 5
* **Pregunta:** ¿Qué endpoint se utiliza para consultar la posición satelital inmediata de una placa?
* **Respuesta:** `GET https://tower-api.controlt.com.co/Hub/CurrentPosition/{placa}`. Devuelve latitud, longitud, rumbo y velocidad actual.

---

### Tarjeta 6
* **Pregunta:** ¿Qué datos mínimos se envían para cerrar una alarma en ControlT?
* **Respuesta:** El ID de la alarma (`idMonitoringOrdersAlarm`), la placa (`licensePlate`), el número de viaje (`numberTrip`), el código de la novedad (`noveltySelected: 1` para En Ruta) y el comentario descriptivo de la ubicación y velocidad.

---

### Tarjeta 7
* **Pregunta:** ¿Por qué separamos el "Piloto de Seguimiento" del "Monitoreo de Alertas Críticas"?
* **Respuesta:** Porque el Piloto de Seguimiento realiza una acción de escritura cerrando alarmas rutinarias en ControlT, mientras que el Monitoreo de Alertas es una tarea de vigilancia y seguridad ciudadana que no cierra nada, sino que avisa a los humanos por Telegram para intervenir ante peligros.

---

### Tarjeta 8
* **Pregunta:** ¿Cómo evita el sistema enviar múltiples alertas repetidas si un camión sigue en zona prohibida?
* **Respuesta:** Mediante un filtro anti-spam en la tabla MySQL `alertas_notificadas`, que revisa si la misma placa y tipo de evento ya fue notificada en una ventana de 60 minutos.

---

### Tarjeta 9
* **Pregunta:** ¿Qué papel juega Hostinger en esta arquitectura?
* **Respuesta:** Aloja la base de datos MySQL (`srv2184.hstgr.io`) y ejecuta un temporizador programado (Cron Job) cada 10 minutos que despierta al motor inteligente de ToCIE de forma 100% desatendida.

---

### Tarjeta 10
* **Pregunta:** ¿Qué beneficio operativo obtiene Elogia con esta integración?
* **Respuesta:** Elimina el 80% de la carga manual repetitiva de los operadores en llamadas de seguimiento, garantiza auditoría inmutable de cada acción en MySQL y reduce el tiempo de respuesta ante desvíos o emergencias viales a menos de 1 minuto.
