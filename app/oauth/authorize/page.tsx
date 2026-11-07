'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

function OAuthAuthorizeContent() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';
  const clientId = searchParams.get('client_id') || '';

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
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          redirectUri,
          state,
          clientId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setErrorMessage(data.error || 'Credenciales inválidas en ControlT.');
      }
    } catch (err: any) {
      setErrorMessage(`Error de conexión: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 pb-6 bg-gradient-to-b from-slate-900 to-indigo-950 text-white text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Conexión Segura MCP / ChatGPT
          </div>
          <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl shadow-lg">
            🚛
          </div>
          <h1 className="text-xl font-bold">Autorizar ControlT</h1>
          <p className="text-xs text-slate-300 mt-1">
            Inicia sesión para vincular tu cuenta con tu Asistente IA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Usuario ControlT</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="operador@empresa.com"
                required
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Contraseña ControlT</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tu contraseña de ControlT"
                required
                disabled={isLoading}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <span>Autorizar y Conectar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
            Tus credenciales se validan directamente con ControlT Tower.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Cargando formulario...</div>}>
      <OAuthAuthorizeContent />
    </Suspense>
  );
}

