# Remote MCP Server for ControlT (ToCIE)

Remote Model Context Protocol (MCP) server enabling Claude (Web, Desktop, Mobile) and ChatGPT (Web, Mobile) to operate the ControlT Fleet Monitoring and Alarm Management Platform via natural language, with real-user attribution and zero credential exposure.

---

## Architecture Overview

- **Serverless Integration:** Hosted inside Next.js 14 App Router within Vercel's serverless budget.
- **Transport:** MCP Streamable HTTP (stateless, JSON responses, no SSE). Supported methods: `initialize`, `ping`, `tools/list`, `tools/call`.
- **OAuth 2.1 Compliance:**
  - Metadata discovery endpoints: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
  - RFC 7591 dynamic client registration.
  - Authorization endpoint with mandatory PKCE (S256).
  - Token endpoint supporting `authorization_code` and `refresh_token`.
  - Stateless HMAC-SHA256 signed tokens bound to revocable connection IDs.
- **Security & Data Isolation (Secret Zero Exposure):**
  - **Single-Use Invitation Links:** Users set up their ControlT credentials securely via web; only SHA-256 hashes are stored in DB (2h expiry, max 5 attempts).
  - **AES-256-GCM Encryption:** Passwords encrypted at rest using a 64-hex master key and user ID as Additional Authenticated Data (AAD). Decrypted strictly in memory per session.
  - **One-Time Access Tickets:** Connectors authenticate via short-lived alphanumeric tickets (`XXXX-XXXX-XXXX-XXXX`, 15-min TTL, stored as HMAC hash) generated from `/mcp`.
  - **Revocable Connections:** Max 3 active connections per user/scope; validated in DB on every tool invocation.
  - **Distributed Session Locks:** DB-backed mutex to prevent concurrent conflicting operations on the same user session (`USER_BUSY`).
  - **Brute-Force Defense:** IP-based failure limits (10 failures / 15 minutes).
  - **Audit Logging:** Every write action audited (actor, user, connection ID, result, error code, duration ms).

---

## Environment Variables (`.env`)

Refer to `.env.example` for all required environment keys:
- `CONTROLT_USERNAME`, `CONTROLT_PASSWORD`, `CONTROLT_COMPANY_ID`
- `CONTROLT_AUTH_URL`, `CONTROLT_API_BASE_URL`
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `MCP_ADMIN_API_KEY`: Secret Bearer token for administrative diagnostics.
- `MCP_ENCRYPTION_KEY`: 64-hex character master key for AES-256-GCM credential encryption.
- `MCP_HMAC_SECRET`: Secret key for signing OAuth tokens and hashing tickets.

---

## Verified Increments

- [x] **Increment 0: Read-Only Mappings & Diagnostic Endpoint**
  - Mapped ControlT read-only endpoints:
    - `POST /login/oauth`: Authentication.
    - `GET /Home/resumeForUI`: Active trips & fleet status.
    - `GET /Home/alarms/attendForUI`: Pending critical alarms.
    - `GET /Hub/CurrentPosition/{plate}`: Real-time GPS telemetry.
    - `GET /Binnacle/{idOrder}`: Trip event log.
    - `GET /Alarms/attend/NoveltiesByAlarm/{idAlarm}`: Novelty catalog.
  - Created `GET /api/mcp/diagnostic`:
    - Secured by `MCP_ADMIN_API_KEY`.
    - Validates ControlT connectivity and schema compliance without leaking PII or credentials.
    - Returns standardized operational health JSON.
- [x] **Increment 1: ControlT Client with Per-User Session, Encryption & Distributed Locks**
  - Database tables created and verified in Hostinger MySQL (`mcp_credenciales`, `mcp_candados`, `mcp_auditoria`, `mcp_conexiones`, `mcp_tickets`, `mcp_invitaciones`, `mcp_ip_rate_limits`).
  - Implemented `lib/mcp-crypto.ts`:
    - AES-256-GCM encryption with 64-hex character master key.
    - User ID as Additional Authenticated Data (AAD) prevents ciphertext transplanting across rows.
    - In-memory decryption only; zero credentials leaked in logs or error messages.
  - Implemented `lib/mcp-db.ts`:
    - Credential storage and atomic distributed session locks (`mcp_candados`).
    - Returns standardized `USER_BUSY` when concurrent requests collide on the same user session.
    - Write auditing with duration, actor, and error codes.
  - Updated `lib/controlt-service.ts`:
    - Supports per-user sessions and multi-tenant authentication with volatile token cache.
    - Actions (`attendAlarm`, queries) run under the authenticated operator's real identity in ControlT.
- [x] **Increment 2: Access Tickets & Revocable Connections**
  - Implemented `lib/mcp-auth-service.ts`:
    - One-time access ticket generation: formatted as `XXXX-XXXX-XXXX-XXXX` (16 chars, unambiguous alphabet), 15-min TTL, max 5 tickets/hour.
    - Zero plaintext storage: tickets stored strictly as HMAC-SHA256 hashes (`HMAC(MCP_HMAC_SECRET, "ticket:" + normalized)`).
    - Atomic redemption: marked as used (`usado = 1`); replay attempts immediately rejected (`INVALID_TICKET`).
    - Revocable connections: validated on each invocation; immediate block on revocation (`CONNECTION_REVOKED`); 90-day inactivity cutoff.
    - Maximum 3 active connections per user enforced; oldest connection automatically revoked when a 4th is created.
    - Anti-brute-force defense by IP (`mcp_ip_rate_limits`): blocks IP after 10 failed attempts for 15 minutes (`IP_BLOCKED`).
  - Implemented Web Management UI at `/mcp` (`app/mcp/page.tsx`):
    - Generate one-time tickets with clipboard copy and expiration timer.
    - View active AI connections with device details, creation date, and last used date.
    - Instant "Revocar Acceso" action.
  - Implemented API handler at `app/api/mcp/connections/route.ts` (`GET`, `POST`, `DELETE`).
  - Added "Conector MCP" button to global navigation `components/Navbar.tsx`.
- [x] **Increment 3: OAuth 2.1 Metadata, Dynamic Registration & PKCE Flow**
  - Metadata discovery endpoints:
    - `GET /.well-known/oauth-authorization-server` (RFC 8414).
    - `GET /.well-known/oauth-protected-resource`.
  - Dynamic client registration (RFC 7591): `POST /api/oauth/register` with database backing in `mcp_oauth_clients`.
  - Implemented `lib/mcp-oauth.ts`:
    - Mandatory PKCE S256 verification (`verifyPkce`).
    - HMAC-SHA256 signed Authorization Codes (5-min TTL).
    - HMAC-SHA256 signed Access Tokens (1-hour TTL) and Refresh Tokens (30-day TTL).
  - Authorization Endpoint & Screen:
    - `POST /api/oauth/authorize`: Enforces PKCE S256, validates redirect URIs, redeems single-use access tickets, links revocable connection.
    - Updated `app/oauth/authorize/page.tsx`: Clean UI prompting for corporate email and one-time access ticket (never plain passwords!).
  - Token Endpoint:
    - `POST /api/oauth/token` (and `POST /oauth/token`): Supports `authorization_code` with PKCE validation and `refresh_token` with live DB revocation checks.
- [x] **Increment 4: Stateless MCP Streamable HTTP Dispatcher**
  - Fully refactored `app/api/mcp/route.ts` into a stateless Streamable HTTP transport (pure JSON-RPC 2.0 without SSE).
  - Implemented methods:
    - `initialize`: Returns protocol `2024-11-05`, server `ToCIE ControlT MCP Server v2.0.0`, capabilities, and explicit instructions against prompt-injection and guidance on action vs inquiry.
    - `ping`: Immediate `{}` response.
    - `tools/list`: Categorized tools with `readOnlyHint`, `destructiveHint`, and backward-compatible aliases for cached clients.
    - `tools/call`: Authenticates via OAuth 2.1 access token or Admin key, enforces 45s distributed lock (`USER_BUSY`), enforces 40s execution budget, and releases lock safely.
  - Implemented `resolveCaller`: Validates Bearer token, checks connection in DB (`mcp_conexiones`), checks active status.
- [x] **Increment 5: Read-Only MCP Tools (`consultar_viajes`, `consultar_alarmas`, `consultar_gps`, `consultar_bitacora`, `consultar_novedades_alarma`)**
  - Enhanced all read-only tools (`readOnlyHint: true`) with:
    - Filters: `filtro_semaforo`, `prioridad`, and flexible `busqueda` (plate, trip number, driver name).
    - Prompt-injection sanitization: all ControlT fields sanitized as data.
    - Literal action instructions in text content and `structuredContent.instruccionSiguienteAccion`.
    - Standardized error codes: `INVALID_PARAMETER` on missing required params, `NOT_FOUND` on unknown entities.
  - Verified live queries against ControlT returning active trips (121+ trips), real alarms (100 active), and real-time GPS telemetry for active vehicles.
- [x] **Increment 6: Mutation Tools with Verification (`atender_alarma`, `atender_lote_a_tiempo`)**
  - Implemented single-alarm mutation tool `atender_alarma` (`readOnlyHint: false, destructiveHint: false`):
    - Strict parameter validation: missing `alarmaId` yields immediate `INVALID_PARAMETER`.
    - Exact matching & state inspection: prevents touching arbitrary records; if already resolved yields `ACTION_NOT_ALLOWED`; if not in pending queue yields `NOT_FOUND`.
    - Post-action verification: re-queries live alarms queue after submission to certify the alarm is no longer pending before reporting success.
    - Identity attribution: mutations submitted directly with the authenticated operator's corporate account in ControlT.
    - Write auditing in MySQL: dual audit entry recorded in `mcp_auditoria` and `atenciones_auditoria` with latency, connection ID, and actor.
  - Implemented batch mutation tool `atender_lote_a_tiempo` (`readOnlyHint: false, destructiveHint: false`):
    - Automated resolution restricted strictly to on-time vehicles (`state_next_point = '1'` or `A TIEMPO`) with routine tracking alarms (`LLAMADA DE SEGUIMIENTO`).
    - Configurable batch safety limit (default 5, max 10) avoiding execution timeouts within Vercel's limits.
    - Dual write auditing recorded per item and summary batch.
  - Verified tests (6/6 passing): parameter validation, non-existent rejection (`NOT_FOUND`), batch candidate filter, distributed lock contention (`USER_BUSY`), and MySQL audit logging.
- [x] **Increment 7: End-to-End Connector Guides for Claude & ChatGPT**
  - Created step-by-step connection guides:
    - [GUIA_CONECTOR_CLAUDE.md](file:///c:/Users/GRAZIANY%20GOMEZ/OneDrive%20-%20DAABON/AA%20Systems/DEV/Auto_trafico-CT/docs/GUIA_CONECTOR_CLAUDE.md): Setup for Claude Desktop (`claude_desktop_config.json`) and Claude Web/Mobile (OAuth 2.1 authorization with single-use tickets).
    - [GUIA_CONECTOR_CHATGPT.md](file:///c:/Users/GRAZIANY%20GOMEZ/OneDrive%20-%20DAABON/AA%20Systems/DEV/Auto_trafico-CT/docs/GUIA_CONECTOR_CHATGPT.md): Custom GPT Action setup with OAuth 2.1, cache tolerance rules, backwards-compatible aliases, and real-operator attribution.
  - Documented prompt catalog in natural language for fleet status, GPS telematics, ETA punctuality, single-alarm attendance, and batch attendance.
  - Verified instant connection revocation workflow from web UI at `/mcp`.

---

## Connector Guides & References

- **Claude Setup Guide:** `docs/GUIA_CONECTOR_CLAUDE.md`
- **ChatGPT Setup Guide:** `docs/GUIA_CONECTOR_CHATGPT.md`
- **Web Token Management:** `app/mcp/page.tsx` (`https://<your-domain>/mcp`)
- **OAuth 2.1 Authorize Screen:** `app/oauth/authorize/page.tsx` (`https://<your-domain>/oauth/authorize`)
- **OAuth Discovery:** `/.well-known/oauth-authorization-server` & `/.well-known/oauth-protected-resource`

---

## Diagnostic Command

To verify server health and ControlT connectivity:
```bash
curl -H "Authorization: Bearer <MCP_ADMIN_API_KEY>" https://<your-domain>/api/mcp/diagnostic
```

