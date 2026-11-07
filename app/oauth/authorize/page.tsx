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
    <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-[#D2DFD4]">
        <div className="p-7 pb-6 bg-[#263028] text-white text-center border-b border-[#39473C]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#39473C] border border-[#5F7663] text-[#B4C7B7] text-[10px] font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#94AC98]" />
            Conexión Segura MCP / ChatGPT
          </div>
          <div className="mb-2.5 flex justify-center">
            <div className="bg-white p-2 rounded-xl shadow-xs inline-block">
              <img 
                src="/logo-elogia.png" 
                alt="Elogia Soluciones Logísticas" 
                className="h-10 w-auto object-contain" 
              />
            </div>
          </div>
          <h1 className="text-lg font-bold text-white">Torre de Control Inteligente Elogia</h1>
          <p className="text-xs text-[#CBD7CE] font-semibold mt-0.5">(ToCIE)</p>
          <p className="text-[11px] text-[#A8BFAB] mt-1.5">
            Autoriza a tu asistente IA a consultar telemetría con tus credenciales de ControlT
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 pt-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#263028] block">Usuario o Correo ControlT</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="operador@elogia.com.co"
                required
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs text-[#263028] focus:outline-none focus:ring-2 focus:ring-[#758F79]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#263028] block">Contraseña ControlT</label>
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
                className="w-full pl-9 pr-10 py-2 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs text-[#263028] focus:outline-none focus:ring-2 focus:ring-[#758F79]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#5F7663]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#5F7663] hover:bg-[#4B5E4F] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando con ControlT...</span>
              </>
            ) : (
              <>
                <span>Autorizar y Conectar ToCIE</span>
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

