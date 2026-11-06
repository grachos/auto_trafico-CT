-- ========================================================
-- SCHEMA SQL PARA SUPABASE / POSTGRESQL - Auto_trafico-CT
-- Torre de Control de Tráfico Asistida por IA (ControlT)
-- ========================================================

-- 1. Tabla de Viajes y Cumplimiento ETA
CREATE TABLE IF NOT EXISTS viajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nro_viaje VARCHAR(20) NOT NULL UNIQUE,
    placa VARCHAR(10) NOT NULL,
    conductor VARCHAR(120) NOT NULL,
    telefono VARCHAR(30),
    cliente VARCHAR(120) NOT NULL,
    origen VARCHAR(80) NOT NULL,
    destino VARCHAR(80) NOT NULL,
    cita_programada TIMESTAMPTZ,
    eta_estimada TIMESTAMPTZ,
    semaforo_eta VARCHAR(20) NOT NULL DEFAULT 'A_TIEMPO', -- 'A_TIEMPO', 'TARDE', 'TOLERANCIA', 'SIN_CALCULO'
    porcentaje_ruta NUMERIC(5,2) DEFAULT 0,
    velocidad_kmh NUMERIC(5,1) DEFAULT 0,
    ubicacion TEXT,
    ultimo_evento TEXT,
    novedad_resumen TEXT,
    estado_viaje VARCHAR(30) DEFAULT 'En Transíto',
    actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Alarmas de ControlT
CREATE TABLE IF NOT EXISTS alarmas (
    id VARCHAR(30) PRIMARY KEY, -- ID Alarma en ControlT (ej: 8329496)
    nro_viaje VARCHAR(20) NOT NULL,
    placa VARCHAR(10) NOT NULL,
    prioridad VARCHAR(20) NOT NULL, -- 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'
    evento VARCHAR(100) NOT NULL,    -- 'LLAMADA DE SEGUIMIENTO', 'FUERA DE RUTA', etc.
    fecha_hora_alarma TIMESTAMPTZ NOT NULL,
    velocidad_kmh NUMERIC(5,1) DEFAULT 0,
    ubicacion TEXT,
    semaforo_eta VARCHAR(20) DEFAULT 'A_TIEMPO',
    ultimo_evento_resumen TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'ATENDIDA', 'CANCELADA'
    novedad_aplicada TEXT,
    comentario_registrado TEXT,
    atendida_por VARCHAR(80),
    fecha_atencion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Auditoría e Historial de Atenciones del Agente
CREATE TABLE IF NOT EXISTS atenciones_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alarma_id VARCHAR(30) NOT NULL,
    nro_viaje VARCHAR(20) NOT NULL,
    placa VARCHAR(10) NOT NULL,
    novedad_aplicada TEXT NOT NULL,
    comentario TEXT NOT NULL,
    canal_origen VARCHAR(30) NOT NULL, -- 'WEB_APP', 'TELEGRAM', 'MCP_AGENT', 'PILOTO_AUTOMATICO'
    usuario_origen VARCHAR(80),
    exitoso BOOLEAN DEFAULT TRUE,
    respuesta_controlt JSONB,
    fecha_registro TIMESTAMPTZ DEFAULT now()
);

-- 4. Matriz de Mapeo de Novedades (Configurable en Caliente)
CREATE TABLE IF NOT EXISTS reglas_mapeo_novedades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patron_ultimo_evento TEXT NOT NULL,
    novedad_destino VARCHAR(100) NOT NULL,
    plantilla_comentario TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- Inserción de reglas iniciales validadas
INSERT INTO reglas_mapeo_novedades (patron_ultimo_evento, novedad_destino, plantilla_comentario)
VALUES 
    ('Salida localidad cliente', 'En ruta sin novedad alguna', 'Vehículo en tránsito tras salida de localidad cliente {cliente}. Continúa en ruta sin novedad alguna.'),
    ('Salida de zona prohibida', 'En ruta sin novedad alguna', 'Vehículo en tránsito a {velocidad} km/h tras salida de zona controlada. Continúa en ruta sin novedad alguna.'),
    ('Salida puesto de control virtual', 'En ruta sin novedad alguna', 'Vehículo en movimiento a {velocidad} km/h. Ruta sin novedad.'),
    ('En ruta hacia punto de cargue', 'En ruta sin novedad alguna', 'Vehículo en ruta hacia punto de cargue {cliente}. Continúa sin novedad alguna.'),
    ('Ingreso a planta para descargue', 'Inicio de descargue', 'Vehículo reporta llegada e inicio de descargue en instalaciones.')
ON CONFLICT DO NOTHING;

-- 5. Tabla de Usuarios Autorizados en Telegram
CREATE TABLE IF NOT EXISTS telegram_usuarios_autorizados (
    chat_id BIGINT PRIMARY KEY,
    username VARCHAR(80),
    nombre_completo VARCHAR(120),
    rol VARCHAR(20) DEFAULT 'OPERADOR', -- 'ADMIN', 'OPERADOR', 'SOLO_LECTURA'
    notificaciones_activas BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_viajes_semaforo ON viajes(semaforo_eta);
CREATE INDEX IF NOT EXISTS idx_alarmas_estado ON alarmas(estado);
CREATE INDEX IF NOT EXISTS idx_alarmas_prioridad ON alarmas(prioridad);
CREATE INDEX IF NOT EXISTS idx_atenciones_fecha ON atenciones_auditoria(fecha_registro DESC);

