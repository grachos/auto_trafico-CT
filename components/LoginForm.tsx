'use client';

import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (user: { username: string; name: string }) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu usuario y contraseña de ControlT');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Guardar sesión localmente para soporte offline / caché rápida
        if (typeof window !== 'undefined') {
          localStorage.setItem('ct_user_session', JSON.stringify(data.user));
        }
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(data.error || 'Credenciales inválidas en ControlT. Verifica tus datos.');
      }
    } catch (err: any) {
      setErrorMessage(`Error de conexión con el servidor: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative z-10 transition-all">
        {/* Cabecera */}
        <div className="p-8 pb-6 bg-gradient-to-b from-slate-900 to-indigo-950 text-white text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Torre de Control ControlT
          </div>

          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-3xl">
            🚛
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Acceso Operativo</h1>
          <p className="text-xs text-slate-300 mt-1">
            Inicia sesión con tus credenciales asignadas en <strong>ControlT Tower</strong>
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5">
          {/* Alerta de Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Campo Usuario */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Usuario o Correo ControlT
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ej: operador@empresa.com"
                disabled={isLoading}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Campo Contraseña con Icono de Ver/Ocultar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">
                Contraseña ControlT
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña de ControlT"
                disabled={isLoading}
                required
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
              />
              {/* Botón del Ojo para Ver / Ocultar Contraseña */}
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Botón de Enviar */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando con ControlT...</span>
              </>
            ) : (
              <>
                <span>Ingresar a la Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Pie informativo */}
          <div className="pt-2 border-t border-slate-200/80 text-center space-y-1">
            <p className="text-[11px] text-slate-500">
              Validación en tiempo real contra el servidor seguro de ControlT.
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 pt-1">
              <span>🔒 OAuth 2.0</span>
              <span>&bull;</span>
              <span>☁️ Hostinger MySQL</span>
              <span>&bull;</span>
              <span>🤖 Asistente IA</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
