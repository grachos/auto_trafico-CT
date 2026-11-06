'use client';

import React from 'react';
import { ShieldCheck, Radio, Sparkles, RefreshCw, MessageSquare } from 'lucide-react';

interface NavbarProps {
  autopilot: boolean;
  onToggleAutopilot: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenChat: () => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  autopilot,
  onToggleAutopilot,
  onRefresh,
  isLoading,
  onOpenChat,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand & Connection */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 leading-none">ControlT Torre de Control</h1>
              <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                IA Traffic Agent
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-slate-500 font-medium">Conectado a ControlT API (ELOGIA)</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          
          {/* Autopilot Switch */}
          <button
            onClick={onToggleAutopilot}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              autopilot
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autopilot ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Piloto Automático: {autopilot ? 'ACTIVO' : 'OFF'}</span>
          </button>

          {/* Chat with Agent Button */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chatear con la IA</span>
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-200"
            title="Refrescar datos en vivo"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

      </div>
    </header>
  );
};

