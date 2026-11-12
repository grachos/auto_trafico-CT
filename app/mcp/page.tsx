'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Clock,
  Laptop,
  AlertTriangle,
  ArrowLeft,
  Lock,
  User,
  Send,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface ActiveConnection {
  id: string;
  usuario: string;
  clientId: string;
  clientLabel: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string;
}

interface RegisteredUser {
  usuario: string;
  nombre?: string;
  estado?: string;
  rol?: string;
}

export default function McpManagementPage() {
  const [user, setUser] = useState<{ username: string; name?: string; role?: string } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Registered operators for Admin selector
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>('');
  const [customTargetUser, setCustomTargetUser] = useState<string>('');

  // Ticket states
  const [ticket, setTicket] = useState<string | null>(null);
  const [ticketUser, setTicketUser] = useState<string | null>(null);
  const [ticketExpiresAt, setTicketExpiresAt] = useState<string | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Active connections
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Check current session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          const u = data.user;
          setUser(u);
          const adminCheck = u.role === 'ADMIN' || u.username === 'ggomez@elogia.com.co';
          setIsAdmin(adminCheck);
          setSelectedTargetUser(u.username);
          loadConnectionsData(u.username);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoadingAuth(false);
      }
    }
    checkAuth();
  }, []);

  // Load active connections and registered users
  const loadConnectionsData = async (defaultUser?: string) => {
    setLoadingConnections(true);
    try {
      const res = await fetch('/api/mcp/connections');
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
        if (data.isAdmin) {
          setIsAdmin(true);
          if (Array.isArray(data.registeredUsers) && data.registeredUsers.length > 0) {
            setRegisteredUsers(data.registeredUsers);
            if (!selectedTargetUser) {
              setSelectedTargetUser(defaultUser || data.registeredUsers[0]?.usuario || '');
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Generate a new ticket (Admin only)
  const handleGenerateTicket = async () => {
    const finalTarget = (customTargetUser || selectedTargetUser || user?.username || '').trim().toLowerCase();
    if (!finalTarget) {
      setTicketError('Debes seleccionar o escribir el correo del operador de ControlT');
      return;
    }

    setGeneratingTicket(true);
    setTicketError(null);
    setCopied(false);
    setCopiedMsg(false);

    try {
      const res = await fetch('/api/mcp/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUser: finalTarget }),
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setTicket(data.ticket);
        setTicketUser(data.targetUser || finalTarget);
        setTicketExpiresAt(data.expiresAt);
      } else {
        setTicketError(data.message || data.error || 'No se pudo generar el ticket de acceso');
      }
    } catch {
      setTicketError('Error de red al contactar al servidor');
    } finally {
      setGeneratingTicket(false);
    }
  };

  // Copy raw ticket to clipboard
  const handleCopyTicket = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Copy formatted instructions to send to the operator
  const handleCopyOperatorMessage = () => {
    if (!ticket) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio';
    const msg = `🔑 *Ticket de Acceso MCP ToCIE (ControlT)*\n\n` +
      `Hola! Tu administrador ha generado un ticket temporal para que conectes tu asistente (Claude o ChatGPT) a tu cuenta de ControlT:\n\n` +
      `• *Operador:* ${ticketUser}\n` +
      `• *Código del Ticket:* \`${ticket}\`\n` +
      `• *Validez:* 15 minutos (un solo uso)\n` +
      `• *URL del Conector:* \`${origin}/api/mcp\`\n\n` +
      `👉 *Instrucciones:* En la pantalla de autorización de Claude o ChatGPT, ingresa tu correo corporativo (${ticketUser}) y pega este código. Recuerda que no debes escribir tu contraseña en el chat.`;

    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  // Revoke connection
  const handleRevoke = async (connectionId: string, connUser: string) => {
    if (!confirm(`¿Estás seguro de que deseas revocar la conexión para ${connUser}? El asistente perderá acceso inmediatamente.`)) {
      return;
    }
    setRevokingId(connectionId);
    try {
      const res = await fetch(`/api/mcp/connections?id=${encodeURIComponent(connectionId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      } else {
        alert(data.message || 'No se pudo revocar la conexión');
      }
    } catch {
      alert('Error de red al revocar la conexión');
    } finally {
      setRevokingId(null);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#5F7663]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-medium text-sm">Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#D2DFD4] p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Lock className="w-6 h-6 text-amber-700" />
          </div>
          <h2 className="text-lg font-bold text-[#263028] mb-2">Acceso Requerido</h2>
          <p className="text-sm text-stone-600 mb-6">
            Debes iniciar sesión con tu cuenta corporativa para administrar los conectores y tickets de IA.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#263028] hover:bg-[#1C241E] text-white font-medium rounded-lg text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio de Sesión
          </Link>
        </div>
      </div>
    );
  }

  // Count active connections per user
  const userConnCounts: Record<string, number> = {};
  connections.forEach((c) => {
    const u = c.usuario.toLowerCase();
    userConnCounts[u] = (userConnCounts[u] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-[#F7F9F6] text-[#263028]">
      {/* Header */}
      <header className="bg-white border-b border-[#D2DFD4] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg border border-[#D2DFD4] hover:bg-stone-50 text-stone-600 transition-colors"
              title="Volver a la Torre de Control"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-[#263028] leading-tight">
                Conector MCP <span className="text-[#5F7663] font-extrabold">(Claude & ChatGPT)</span>
              </h1>
              <p className="text-xs text-stone-500">
                Sesión: <span className="font-semibold text-stone-700">{user.username}</span> {isAdmin && <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] ml-1">ADMIN</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              OAuth 2.1 Activo
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Ticket Generation Section: ONLY FOR ADMINISTRATORS */}
        {isAdmin ? (
          <section className="bg-white rounded-xl border border-[#D2DFD4] p-6 shadow-xs">
            <div className="pb-5 border-b border-[#E8EEE9]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#5F7663]" />
                <h2 className="text-base font-bold text-[#263028]">Generación de Tickets MCP para Operadores</h2>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Como Administrador, puedes generar un ticket de un solo uso asignado a la cuenta de un operador registrado en ControlT. El operador utilizará este código para autorizar a Claude o ChatGPT sin revelar su contraseña.
              </p>
            </div>

            {/* Selector de Usuario Registrado */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Operador de ControlT Destinatario:
                </label>
                {registeredUsers.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedTargetUser}
                      onChange={(e) => {
                        setSelectedTargetUser(e.target.value);
                        setCustomTargetUser('');
                      }}
                      className="w-full text-xs px-3 py-2.5 bg-stone-50 border border-[#D2DFD4] rounded-lg focus:outline-hidden focus:border-[#5F7663] text-stone-800 font-medium"
                    >
                      {registeredUsers.map((u) => (
                        <option key={u.usuario} value={u.usuario}>
                          {u.usuario} {u.nombre ? `(${u.nombre})` : ''} - {u.rol || 'OPERADOR'}
                        </option>
                      ))}
                      <option value="__custom__">-- Escribir otro correo de ControlT --</option>
                    </select>

                    {selectedTargetUser === '__custom__' && (
                      <input
                        type="email"
                        placeholder="ej: operador@elogia.com.co"
                        value={customTargetUser}
                        onChange={(e) => setCustomTargetUser(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-[#D2DFD4] rounded-lg focus:outline-hidden focus:border-[#5F7663]"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="email"
                    placeholder="ej: operador@elogia.com.co"
                    value={selectedTargetUser}
                    onChange={(e) => setSelectedTargetUser(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-white border border-[#D2DFD4] rounded-lg focus:outline-hidden focus:border-[#5F7663]"
                  />
                )}
              </div>

              <div>
                <button
                  onClick={handleGenerateTicket}
                  disabled={generatingTicket}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#263028] hover:bg-[#1C241E] disabled:bg-stone-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  {generatingTicket ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Generar Ticket
                    </>
                  )}
                </button>
              </div>
            </div>

            {ticketError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{ticketError}</span>
              </div>
            )}

            {ticket && (
              <div className="mt-6 bg-[#F4F7F4] border border-[#C6D8C8] rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      <User className="w-3.5 h-3.5" />
                      Ticket emitido para: <span className="underline font-mono text-stone-900">{ticketUser}</span>
                    </div>
                    <div className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-[#263028] mt-1 select-all">
                      {ticket}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-2">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Vence a las: {new Date(ticketExpiresAt || '').toLocaleTimeString()} (Válido 15 minutos)</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      onClick={handleCopyTicket}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-[#B8CEBB] hover:bg-stone-50 text-[#263028] text-xs font-semibold rounded-lg transition-colors shadow-xs"
                      title="Copiar solo el código"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ¡Código Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-600" />
                          Copiar Código
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCopyOperatorMessage}
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#263028] hover:bg-[#1C241E] text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                      title="Copiar mensaje con instrucciones listo para WhatsApp / Telegram / Correo"
                    >
                      {copiedMsg ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ¡Mensaje Copiado!
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Copiar Mensaje para Operador
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#D2DFD4] text-xs text-stone-600">
                  👉 <strong>Envía este ticket al operador:</strong> El operador debe ingresar a Claude o ChatGPT, indicar su correo (<strong>{ticketUser}</strong>) y pegar este código en la pantalla de autorización. Al canjearse, creará una conexión segura y el ticket quedará invalidado de inmediato.
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="bg-stone-50 rounded-xl border border-stone-200 p-5 text-xs text-stone-700 flex items-start gap-3">
            <Lock className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-stone-900 text-sm mb-1">Generación de Tickets MCP Restringida</h3>
              <p className="leading-relaxed">
                Por políticas de seguridad corporativa, la generación de tickets para asistentes IA (Claude o ChatGPT) está reservada exclusivamente a los <strong>Administradores de la Torre de Control</strong>.
              </p>
              <p className="mt-2 text-stone-600">
                Si requieres conectar un nuevo asistente a tu cuenta de ControlT, solicita un ticket de acceso a tu administrador. Una vez generado, podrás autorizar tu conector en Claude o ChatGPT.
              </p>
            </div>
          </section>
        )}

        {/* Active Connections Section */}
        <section className="bg-white rounded-xl border border-[#D2DFD4] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E8EEE9]">
            <div>
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#5F7663]" />
                <h2 className="text-base font-bold text-[#263028]">
                  {isAdmin ? 'Conexiones Activas de Asistentes IA (Todos los Operadores)' : 'Tus Conexiones Activas de Asistentes IA'}
                </h2>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Monitoreo en tiempo real de clientes y dispositivos conectados. Cada operador puede tener un <strong>máximo de 3 conexiones activas</strong>.
              </p>
            </div>

            <button
              onClick={() => loadConnectionsData(user.username)}
              disabled={loadingConnections}
              className="p-2 self-end sm:self-auto rounded-lg border border-[#D2DFD4] hover:bg-stone-50 text-stone-600 transition-colors"
              title="Actualizar lista de conexiones"
            >
              <RefreshCw className={`w-4 h-4 ${loadingConnections ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {connections.length === 0 ? (
              <div className="text-center py-10 text-stone-500">
                <Laptop className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No se registran conexiones activas de MCP en este momento</p>
                <p className="text-xs text-stone-400 mt-1">
                  {isAdmin
                    ? 'Genera un ticket arriba para autorizar la conexión de un operador.'
                    : 'Solicita un ticket a tu administrador para autorizar a Claude o ChatGPT.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8EEE9] text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Operador Conectado</th>
                    <th className="py-3 px-3">Asistente / Dispositivo</th>
                    <th className="py-3 px-3">Comenzó a Utilizarlo</th>
                    <th className="py-3 px-3">Último Uso</th>
                    <th className="py-3 px-3 text-center">Conexiones</th>
                    <th className="py-3 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4F0]">
                  {connections.map((conn) => {
                    const activeCount = userConnCounts[conn.usuario.toLowerCase()] || 1;
                    return (
                      <tr key={conn.id} className="hover:bg-[#F9FAF8] transition-colors">
                        <td className="py-3 px-3 font-medium text-[#263028]">
                          <div className="flex items-center gap-1.5 font-bold text-stone-900">
                            <User className="w-3.5 h-3.5 text-[#5F7663]" />
                            {conn.usuario}
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                            ID: {conn.id.substring(0, 16)}...
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-stone-800">{conn.clientLabel}</div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono text-[9px]">
                            {conn.clientId}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-stone-600">
                          {new Date(conn.createdAt).toLocaleDateString()} {new Date(conn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-3 px-3 text-stone-600">
                          {new Date(conn.lastUsedAt).toLocaleDateString()} {new Date(conn.lastUsedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              activeCount >= 3
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {activeCount} / 3 activas
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleRevoke(conn.id, conn.usuario)}
                            disabled={revokingId === conn.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {revokingId === conn.id ? 'Revocando...' : 'Revocar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Security Info Card */}
        <section className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-5 text-xs text-[#263028] space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Políticas de Conexión y Control de Acceso
          </div>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Solo Administradores generan tickets:</strong> Ningún usuario no-administrador puede generar tickets. Cada ticket se emite asignado a la cuenta real del operador.
          </p>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Máximo 3 conexiones activas por operador:</strong> Si un operador enlaza un 4to dispositivo (ej. Claude Desktop, Claude Web, ChatGPT y celular), la conexión más antigua se revoca automáticamente manteniendo un máximo de 3.
          </p>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Revocación Inmediata:</strong> Al hacer clic en «Revocar», el conector se desvincula en tiempo real en la base de datos y cualquier llamada siguiente del asistente queda denegada.
          </p>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Auditoría con identidad real:</strong> Cada acción que el asistente ejecute en ControlT se atribuye en auditoría al correo del operador conectado.
          </p>
        </section>

      </main>
    </div>
  );
}
