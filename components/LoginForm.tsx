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
    <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Círculos de fondo sutiles en verde Elogia */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#758F79]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5F7663]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#D2DFD4] overflow-hidden relative z-10 transition-all">
        {/* Cabecera Elogia */}
        <div className="p-7 pb-6 bg-[#263028] text-white text-center relative border-b border-[#39473C]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#39473C] border border-[#5F7663] text-[#B4C7B7] text-[11px] font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#94AC98]" />
            Acceso Autorizado
          </div>

          <div className="mb-3.5 flex justify-center">
            <div className="bg-white p-2.5 rounded-xl shadow-sm inline-block">
              <img 
                src="/logo-elogia.png" 
                alt="Elogia Soluciones Logísticas" 
                className="h-11 w-auto object-contain" 
              />
            </div>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            Torre de Control Inteligente Elogia
          </h1>
          <p className="text-xs text-[#CBD7CE] font-semibold tracking-wide mt-0.5">
            (ToCIE)
          </p>
          <p className="text-[11px] text-[#A8BFAB] mt-2">
            Inicia sesión con tus credenciales asignadas en <strong>ControlT Tower</strong>
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-7 pt-6 space-y-4">
          {/* Alerta de Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Campo Usuario */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#263028] block">
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
                placeholder="ej: operador@elogia.com.co"
                disabled={isLoading}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs text-[#263028] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#758F79] focus:bg-white transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Campo Contraseña con Icono de Ver/Ocultar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#263028] block">
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
                className="w-full pl-10 pr-11 py-2.5 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs text-[#263028] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#758F79] focus:bg-white transition-all disabled:opacity-50"
              />
              {/* Botón del Ojo para Ver / Ocultar Contraseña */}
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#5F7663] transition-colors focus:outline-none"
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
            className="w-full py-2.5 px-4 rounded-xl bg-[#5F7663] hover:bg-[#4B5E4F] text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando con ControlT Tower...</span>
              </>
            ) : (
              <>
                <span>Ingresar a ToCIE</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Pie informativo */}
          <div className="pt-2 border-t border-[#E8EFE9] text-center space-y-1">
            <p className="text-[11px] text-[#5F7663] font-medium">
              Elogia Soluciones Logísticas • Conexión oficial tower-api.controlt.com.co
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 pt-0.5">
              <span>🔒 OAuth Seguro</span>
              <span>&bull;</span>
              <span>🗄️ MySQL Hostinger</span>
              <span>&bull;</span>
              <span>⚡ Telemetría en Vivo</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

