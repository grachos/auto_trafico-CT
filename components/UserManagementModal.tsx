'use client';

import React, { useState, useEffect } from 'react';
import { Users, X, Shield, ShieldCheck, CheckCircle2, XCircle, Search, RefreshCw, Lock, Radio, AlertTriangle } from 'lucide-react';

interface UserRecord {
  id: number;
  usuario: string;
  nombre: string;
  estado: 'ACTIVO' | 'INACTIVO';
  rol: 'ADMIN' | 'OPERADOR';
  primerLogin: string;
  ultimoLogin: string;
  ultimoCanal: string;
  canalesUsados: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; name?: string; role?: string } | null;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = currentUser?.username?.toLowerCase().trim() === 'ggomez@elogia.com.co' || currentUser?.role === 'ADMIN';

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-admin-user': currentUser?.username || '',
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Error cargando usuarios' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Error de conexión: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleToggleStatus = async (user: UserRecord) => {
    if (user.usuario.toLowerCase().trim() === 'ggomez@elogia.com.co') return;

    const nuevoEstado = user.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setUpdatingUser(user.usuario);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': currentUser?.username || '',
        },
        body: JSON.stringify({
          usuario: user.usuario,
          estado: nuevoEstado,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev =>
          prev.map(u => (u.usuario === user.usuario ? { ...u, estado: nuevoEstado } : u))
        );
        setFeedback({
          type: 'success',
          message: `Usuario ${user.usuario} ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'} con éxito.`,
        });
      } else {
        setFeedback({ type: 'error', message: data.error || 'No se pudo cambiar el estado' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setUpdatingUser(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    u =>
      u.usuario.toLowerCase().includes(search.toLowerCase()) ||
      (u.nombre && u.nombre.toLowerCase().includes(search.toLowerCase())) ||
      (u.canalesUsados && u.canalesUsados.toLowerCase().includes(search.toLowerCase()))
  );

  const totalActivos = users.filter(u => u.estado === 'ACTIVO').length;
  const totalInactivos = users.filter(u => u.estado === 'INACTIVO').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Gestión de Operadores y Acceso</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-[10px] font-semibold text-indigo-200">
                  Panel de Administrador
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Autoriza o suspende el acceso a la plataforma (Web, Telegram, WhatsApp y MCP)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Feedback */}
        {feedback && (
          <div
            className={`p-3 px-6 text-xs flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tarjetas de Métricas & Barra de Búsqueda */}
        <div className="p-6 pb-4 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Operadores</p>
                <p className="text-xl font-bold text-slate-900">{users.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Acceso Activo</p>
                <p className="text-xl font-bold text-emerald-700">{totalActivos}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Acceso Inactivo</p>
                <p className="text-xl font-bold text-rose-700">{totalInactivos}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar operador por usuario, nombre o canal..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {loading && users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Cargando operadores registrados en MySQL...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se encontraron operadores registrados con ese criterio.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Operador / Usuario</th>
                    <th className="py-3 px-3">Rol</th>
                    <th className="py-3 px-3">Canales Usados</th>
                    <th className="py-3 px-3">Último Acceso</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(u => {
                    const isMainAdmin = u.usuario.toLowerCase().trim() === 'ggomez@elogia.com.co';
                    const isUpdating = updatingUser === u.usuario;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{u.nombre || u.usuario}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{u.usuario}</div>
                        </td>

                        <td className="py-3 px-3">
                          {u.rol === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium">
                              Operador
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                            {u.canalesUsados || u.ultimoCanal || 'WEB'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {u.ultimoLogin || u.primerLogin || 'Reciente'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {u.estado === 'ACTIVO' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Inactivo
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isMainAdmin ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-semibold px-2 py-1 rounded-lg bg-slate-100 cursor-not-allowed"
                              title="El administrador principal no puede ser desactivado"
                            >
                              <Lock className="w-3 h-3" />
                              Protegido
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={isUpdating}
                              className={`px-3 py-1 rounded-xl font-semibold text-[11px] transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                                u.estado === 'ACTIVO'
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {isUpdating ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" />
                              ) : u.estado === 'ACTIVO' ? (
                                'Desactivar'
                              ) : (
                                'Activar'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie Informativo */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div>
            💡 Los usuarios desactivados recibirán un aviso de bloqueo inmediato al intentar ingresar.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

