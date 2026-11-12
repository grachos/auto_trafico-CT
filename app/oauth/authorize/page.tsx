'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  User,
  KeyRound,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

function OAuthAuthorizeContent() {
  const searchParams = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';
  const clientId = searchParams.get('client_id') || 'claude';
  const codeChallenge = searchParams.get('code_challenge') || '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';

  const [username, setUsername] = useState('');
  const [ticket, setTicket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !ticket.trim()) {
      setErrorMessage('Por favor ingresa tu usuario y el Ticket de Acceso');
      return;
    }

    if (!codeChallenge) {
      setErrorMessage('Error en la solicitud: Falta el parámetro code_challenge de PKCE.');
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
          ticket: ticket.trim().toUpperCase(),
          redirectUri,
          state,
          clientId,
          codeChallenge,
          codeChallengeMethod,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setErrorMessage(data.error || 'No se pudo autorizar el acceso. Verifica tu ticket.');
      }
    } catch (err: any) {
      setErrorMessage(`Error de conexión: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clientDisplayName =
    clientId.toLowerCase().includes('chatgpt') || clientId.toLowerCase().includes('openai')
      ? 'ChatGPT Connector'
      : 'Claude AI Assistant';

  return (
    <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-[#D2DFD4]">
        {/* Header */}
        <div className="p-7 pb-6 bg-[#263028] text-white text-center border-b border-[#39473C]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#39473C] border border-[#5F7663] text-[#B4C7B7] text-[10px] font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#94AC98]" />
            OAuth 2.1 • PKCE S256
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
          <div className="mt-2 text-xs bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 py-1.5 px-3 rounded-lg inline-block">
            Solicitud de acceso para: <strong>{clientDisplayName}</strong>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-7 pt-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#263028] block">
              Correo Corporativo / Usuario ControlT
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="operador@elogia.com.co"
                required
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs text-[#263028] focus:outline-none focus:ring-2 focus:ring-[#758F79]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#263028] block">
                Ticket de Acceso Temporal (15 min)
              </label>
              <Link
                href="/mcp"
                target="_blank"
                className="text-[11px] font-semibold text-[#5F7663] hover:underline inline-flex items-center gap-1"
              >
                Generar Ticket <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={ticket}
                onChange={(e) => setTicket(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                required
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9F7] border border-[#CBD7CE] rounded-xl text-xs font-mono tracking-wider text-[#263028] focus:outline-none focus:ring-2 focus:ring-[#758F79]"
              />
            </div>
            <p className="text-[11px] text-stone-500 pt-0.5">
              Nunca escribas tu contraseña aquí. Solo usa el ticket temporal generado en tu panel de control.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-[#263028] hover:bg-[#1C241E] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#A8BFAB]" />
                <span>Autorizando conexión segura...</span>
              </>
            ) : (
              <>
                <span>Autorizar Acceso al Asistente</span>
                <ArrowRight className="w-4 h-4 text-[#A8BFAB]" />
              </>
            )}
          </button>

          <div className="pt-2 text-center text-[10px] text-stone-400">
            Conexión protegida con cifrado AES-256-GCM y tokens HMAC revocables.
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#5F7663]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-semibold">Cargando pantalla de autorización...</span>
          </div>
        </div>
      }
    >
      <OAuthAuthorizeContent />
    </Suspense>
  );
}
