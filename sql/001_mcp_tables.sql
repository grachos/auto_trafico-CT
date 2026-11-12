-- =====================================================================
-- MIGRATION: Remote MCP Tables for ControlT Integration (MySQL / MariaDB)
-- Database: u279856486_control_T
-- =====================================================================

-- 1. Credenciales de ControlT cifradas en reposo (AES-256-GCM)
CREATE TABLE IF NOT EXISTS mcp_credenciales (
  usuario VARCHAR(120) NOT NULL PRIMARY KEY,
  encrypted_password TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  actualizado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  requiere_reauth TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Candados distribuidos por sesión para prevenir concurrencia y colisiones
CREATE TABLE IF NOT EXISTS mcp_candados (
  usuario VARCHAR(120) NOT NULL PRIMARY KEY,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  locked_by VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Auditoría de operaciones de escritura ejecutadas vía MCP
CREATE TABLE IF NOT EXISTS mcp_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  referencia VARCHAR(100) NULL,
  actor VARCHAR(100) NOT NULL,
  usuario VARCHAR(120) NOT NULL,
  conexion_id VARCHAR(100) NULL,
  resultado VARCHAR(20) NOT NULL,
  error_code VARCHAR(50) NULL,
  duracion_ms INT DEFAULT 0,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Links de invitación de un solo uso para onboarding seguro
CREATE TABLE IF NOT EXISTS mcp_invitaciones (
  token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  usuario VARCHAR(120) NOT NULL,
  expira_at TIMESTAMP NOT NULL,
  intentos TINYINT DEFAULT 0,
  usado TINYINT(1) DEFAULT 0,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tickets de acceso de un solo uso (XXXX-XXXX-XXXX-XXXX)
CREATE TABLE IF NOT EXISTS mcp_tickets (
  ticket_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  usuario VARCHAR(120) NOT NULL,
  expira_at TIMESTAMP NOT NULL,
  usado TINYINT(1) DEFAULT 0,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Conexiones revocables (Claude, ChatGPT, etc.)
CREATE TABLE IF NOT EXISTS mcp_conexiones (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  usuario VARCHAR(120) NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  scope VARCHAR(100) DEFAULT 'controlt:read controlt:write',
  client_label VARCHAR(100) NULL,
  revocada TINYINT(1) DEFAULT 0,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuario_revocada (usuario, revocada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Protección anti-fuerza bruta por IP
CREATE TABLE IF NOT EXISTS mcp_ip_rate_limits (
  ip VARCHAR(45) NOT NULL PRIMARY KEY,
  fallos INT DEFAULT 1,
  primer_fallo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bloqueado_hasta TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

