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
} from 'lucide-react';
import Link from 'next/link';

interface ActiveConnection {
  id: string;
  clientId: string;
  clientLabel: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string;
}

export default function McpManagementPage() {
  const [user, setUser] = useState<{ username: string; name?: string; role?: string } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [ticket, setTicket] = useState<string | null>(null);
  const [ticketExpiresAt, setTicketExpiresAt] = useState<string | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

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
          setUser(data.user);
          loadConnections();
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

  // Load active connections
  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch('/api/mcp/connections');
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setConnections(data.connections);
      }
    } catch (err: any) {
      console.error('Error loading connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Generate a new ticket
  const handleGenerateTicket = async () => {
    setGeneratingTicket(true);
    setTicketError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/mcp/connections', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.ticket) {
        setTicket(data.ticket);
        setTicketExpiresAt(data.expiresAt);
      } else {
        setTicketError(data.message || 'No se pudo generar el ticket de acceso');
      }
    } catch {
      setTicketError('Error de red al contactar al servidor');
    } finally {
      setGeneratingTicket(false);
    }
  };

  // Copy ticket to clipboard
  const handleCopyTicket = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Revoke connection
  const handleRevoke = async (connectionId: string) => {
    if (!confirm('¿Estás seguro de que deseas revocar este conector? El asistente perderá acceso inmediatamente.')) {
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
            Debes iniciar sesión con tu cuenta corporativa para administrar tus conectores y tickets de IA.
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
                Sesión: <span className="font-semibold text-stone-700">{user.username}</span>
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
        
        {/* Ticket Generation Card */}
        <section className="bg-white rounded-xl border border-[#D2DFD4] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E8EEE9]">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#5F7663]" />
                <h2 className="text-base font-bold text-[#263028]">Ticket de Acceso de Un Solo Uso</h2>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Genera un código temporal para escribir en la pantalla de autorización de Claude o ChatGPT. Vence en 15 minutos.
              </p>
            </div>

            <button
              onClick={handleGenerateTicket}
              disabled={generatingTicket}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#263028] hover:bg-[#1C241E] disabled:bg-stone-300 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              {generatingTicket ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Generar Nuevo Ticket
                </>
              )}
            </button>
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
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Tu Ticket de Acceso (One-Time)
                  </span>
                  <div className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-[#263028] mt-1 select-all">
                    {ticket}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-2">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Vence a las: {new Date(ticketExpiresAt || '').toLocaleTimeString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyTicket}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#B8CEBB] hover:bg-stone-50 text-[#263028] text-sm font-semibold rounded-lg transition-colors shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-600" />
                      Copiar Código
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-[#D2DFD4] text-xs text-stone-600">
                👉 <strong>Instrucciones:</strong> Al conectar tu conector en <strong>Claude</strong> o <strong>ChatGPT</strong>, introduce tu correo corporativo y pega este código en el campo de autorización. Al canjearse, creará una conexión segura y el ticket quedará invalidado de inmediato.
              </div>
            </div>
          )}
        </section>

        {/* Active Connections Table */}
        <section className="bg-white rounded-xl border border-[#D2DFD4] p-6 shadow-xs">
          <div className="flex items-center justify-between pb-5 border-b border-[#E8EEE9]">
            <div>
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#5F7663]" />
                <h2 className="text-base font-bold text-[#263028]">Conexiones Activas de Asistentes IA</h2>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Dispositivos y clientes autorizados con acceso a tu cuenta de ControlT. Máximo 3 activos.
              </p>
            </div>

            <button
              onClick={loadConnections}
              disabled={loadingConnections}
              className="p-2 rounded-lg border border-[#D2DFD4] hover:bg-stone-50 text-stone-600 transition-colors"
              title="Actualizar lista de conexiones"
            >
              <RefreshCw className={`w-4 h-4 ${loadingConnections ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {connections.length === 0 ? (
              <div className="text-center py-10 text-stone-500">
                <Laptop className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No tienes conexiones activas en este momento</p>
                <p className="text-xs text-stone-400 mt-1">
                  Genera un ticket arriba para autorizar a Claude o ChatGPT.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8EEE9] text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Cliente / Dispositivo</th>
                    <th className="py-3 px-2">Alcance (Scope)</th>
                    <th className="py-3 px-2">Autorizado</th>
                    <th className="py-3 px-2">Último Uso</th>
                    <th className="py-3 px-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4F0]">
                  {connections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-[#F9FAF8] transition-colors">
                      <td className="py-3 px-2 font-medium text-[#263028]">
                        <div className="font-semibold">{conn.clientLabel}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{conn.clientId}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[10px]">
                          {conn.scope}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-stone-600">
                        {new Date(conn.createdAt).toLocaleDateString()} {new Date(conn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-2 text-stone-600">
                        {new Date(conn.lastUsedAt).toLocaleDateString()} {new Date(conn.lastUsedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleRevoke(conn.id)}
                          disabled={revokingId === conn.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {revokingId === conn.id ? 'Revocando...' : 'Revocar Acceso'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Security Info Card */}
        <section className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-5 text-xs text-[#263028] space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Arquitectura de Seguridad: Cero Exposición de Credenciales
          </div>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Tus contraseñas nunca viajan a Claude ni a ChatGPT.</strong> La conexión se autentica mediante tickets efímeros firmados por el servidor con expiración de 15 minutos.
          </p>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Revocación Inmediata:</strong> Al hacer clic en «Revocar Acceso», el token se anula de inmediato en la base de datos y cualquier petición futura del asistente será rechazada.
          </p>
          <p className="text-emerald-950/80 leading-relaxed">
            • <strong>Trazabilidad y Auditoría:</strong> Cada acción ejecutada mediante el asistente se registra en ControlT bajo tu usuario real, garantizando autoría individual en cada bitácora y novedad.
          </p>
        </section>

      </main>
    </div>
  );
}

