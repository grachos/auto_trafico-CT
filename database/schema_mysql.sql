-- ========================================================
-- SCHEMA SQL PARA MYSQL (HOSTINGER) - Auto_trafico-CT
-- Base de Datos: u279856486_control_T
-- Servidor: srv2184.hstgr.io (72.60.122.124)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `u279856486_control_T` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `u279856486_control_T`;

-- 1. Tabla de Viajes y Cumplimiento de Citas (Semáforo ETA)
CREATE TABLE IF NOT EXISTS `viajes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `nro_viaje` VARCHAR(20) NOT NULL UNIQUE,
    `placa` VARCHAR(10) NOT NULL,
    `conductor` VARCHAR(120) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `cliente` VARCHAR(120) NOT NULL,
    `origen` VARCHAR(80) NOT NULL,
    `destino` VARCHAR(80) NOT NULL,
    `cita_programada` DATETIME NULL,
    `eta_estimada` DATETIME NULL,
    `semaforo_eta` VARCHAR(20) NOT NULL DEFAULT 'A_TIEMPO', -- 'A_TIEMPO', 'TARDE', 'TOLERANCIA', 'SIN_CALCULO'
    `porcentaje_ruta` DECIMAL(5,2) DEFAULT 0,
    `velocidad_kmh` DECIMAL(5,1) DEFAULT 0,
    `ubicacion` TEXT NULL,
    `ultimo_evento` TEXT NULL,
    `novedad_resumen` TEXT NULL,
    `estado_viaje` VARCHAR(30) DEFAULT 'En Transíto',
    `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_viajes_semaforo` (`semaforo_eta`),
    INDEX `idx_viajes_placa` (`placa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Alarmas de ControlT
CREATE TABLE IF NOT EXISTS `alarmas` (
    `id` VARCHAR(30) PRIMARY KEY, -- ID Alarma en ControlT (ej: 8329496)
    `nro_viaje` VARCHAR(20) NOT NULL,
    `placa` VARCHAR(10) NOT NULL,
    `prioridad` VARCHAR(20) NOT NULL, -- 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'
    `evento` VARCHAR(100) NOT NULL,    -- 'LLAMADA DE SEGUIMIENTO', 'FUERA DE RUTA', etc.
    `fecha_hora_alarma` DATETIME NOT NULL,
    `velocidad_kmh` DECIMAL(5,1) DEFAULT 0,
    `ubicacion` TEXT NULL,
    `semaforo_eta` VARCHAR(20) DEFAULT 'A_TIEMPO',
    `ultimo_evento_resumen` TEXT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'ATENDIDA', 'CANCELADA'
    `novedad_aplicada` TEXT NULL,
    `comentario_registrado` TEXT NULL,
    `atendida_por` VARCHAR(80) NULL,
    `fecha_atencion` DATETIME NULL,
    `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_alarmas_estado` (`estado`),
    INDEX `idx_alarmas_prioridad` (`prioridad`),
    INDEX `idx_alarmas_nro_viaje` (`nro_viaje`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Auditoría e Historial Inmutable de Atenciones del Agente
CREATE TABLE IF NOT EXISTS `atenciones_auditoria` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `alarma_id` VARCHAR(30) NOT NULL,
    `nro_viaje` VARCHAR(20) NOT NULL,
    `placa` VARCHAR(10) NOT NULL,
    `novedad_aplicada` TEXT NOT NULL,
    `comentario` TEXT NOT NULL,
    `canal_origen` VARCHAR(30) NOT NULL, -- 'WEB_APP', 'TELEGRAM', 'MCP_AGENT', 'PILOTO_AUTOMATICO'
    `usuario_origen` VARCHAR(80) NULL,
    `exitoso` TINYINT(1) DEFAULT 1,
    `respuesta_controlt` JSON NULL,
    `fecha_registro` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_atenciones_fecha` (`fecha_registro` DESC),
    INDEX `idx_atenciones_placa` (`placa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Matriz Dinámica de Reglas de Mapeo de Novedades
CREATE TABLE IF NOT EXISTS `reglas_mapeo_novedades` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patron_ultimo_evento` VARCHAR(255) NOT NULL,
    `novedad_destino` VARCHAR(120) NOT NULL,
    `plantilla_comentario` TEXT NOT NULL,
    `activo` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semilla de Reglas Validadas
INSERT INTO `reglas_mapeo_novedades` (`patron_ultimo_evento`, `novedad_destino`, `plantilla_comentario`)
VALUES 
    ('Salida localidad cliente', 'En ruta sin novedad alguna', 'Vehículo en tránsito tras salida de localidad cliente {cliente}. Continúa en ruta sin novedad alguna.'),
    ('Salida de zona prohibida', 'En ruta sin novedad alguna', 'Vehículo en tránsito a {velocidad} km/h tras salida de zona controlada. Continúa en ruta sin novedad alguna.'),
    ('Salida puesto de control virtual', 'En ruta sin novedad alguna', 'Vehículo en movimiento a {velocidad} km/h. Ruta sin novedad.'),
    ('En ruta hacia punto de cargue', 'En ruta sin novedad alguna', 'Vehículo en ruta hacia punto de cargue {cliente}. Continúa sin novedad alguna.'),
    ('Ingreso a planta para descargue', 'Inicio de descargue', 'Vehículo reporta llegada e inicio de descargue en instalaciones.')
ON DUPLICATE KEY UPDATE `patron_ultimo_evento` = `patron_ultimo_evento`;

-- 5. Tabla de Usuarios Autorizados en Telegram
CREATE TABLE IF NOT EXISTS `telegram_usuarios_autorizados` (
    `chat_id` BIGINT PRIMARY KEY,
    `username` VARCHAR(80) NULL,
    `nombre_completo` VARCHAR(120) NULL,
    `rol` VARCHAR(20) DEFAULT 'OPERADOR', -- 'ADMIN', 'OPERADOR', 'SOLO_LECTURA'
    `notificaciones_activas` TINYINT(1) DEFAULT 1,
    `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

