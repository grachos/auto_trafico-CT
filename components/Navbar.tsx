'use client';

import React from 'react';
import { Radio, RefreshCw, User, LogOut, Users, MessageSquareCode, ShieldCheck, Activity, Lock, Bell } from 'lucide-react';

interface NavbarProps {
  autopilot: boolean;
  onToggleAutopilot: () => void;
  alertasActivas?: boolean;
  onToggleAlertas?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenChat: () => void;
  isLive?: boolean;
  currentUser?: { username: string; name?: string; role?: string } | null;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  autopilot,
  onToggleAutopilot,
  alertasActivas = true,
  onToggleAlertas,
  onRefresh,
  isLoading,
  onOpenChat,
  isLive = false,
  currentUser,
  onLogout,
  onOpenUserManagement,
}) => {
  const isAdmin =
    currentUser?.username?.toLowerCase().trim() === 'ggomez@elogia.com.co' || currentUser?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#D2DFD4] px-4 lg:px-8 py-2.5 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Brand & Logo Elogia */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo-elogia.png" 
              alt="Elogia Soluciones Logísticas" 
              className="h-9 w-auto object-contain shrink-0" 
            />
            <div className="h-7 w-[1px] bg-[#D2DFD4] hidden md:block" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#263028] tracking-tight leading-none">
                Torre de Control Inteligente Elogia <span className="text-[#5F7663] font-extrabold">(ToCIE)</span>
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isLive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {isLive ? '🟢 EN VIVO (ControlT)' : '🟡 CONEXIÓN LOCAL'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
              <p className="text-[11px] text-[#5F7663] font-medium truncate max-w-xs md:max-w-md">
                Elogia Soluciones Logísticas • Conexión oficial tower-api.controlt.com.co
              </p>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          
          {/* 1. Piloto de Seguimiento (Atención de Alarmas en ControlT) */}
          {isAdmin ? (
            <button
              onClick={onToggleAutopilot}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                autopilot
                  ? 'bg-[#E8EFE9] text-[#263028] border-[#758F79] shadow-xs hover:bg-[#d8e5da]'
                  : 'bg-white text-slate-600 border-[#D2DFD4] hover:bg-[#F5F8F5]'
              }`}
              title="Atención automática de llamadas de seguimiento en ControlT para viajes A Tiempo (Exclusivo Administrador)"
            >
              <Activity className={`w-3.5 h-3.5 ${autopilot ? 'text-[#5F7663] animate-pulse' : 'text-slate-400'}`} />
              <span>Seguimiento: <strong className={autopilot ? 'text-[#4B5E4F]' : 'text-slate-500'}>{autopilot ? 'ACTIVO' : 'MANUAL'}</strong></span>
              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-[#758F79]/20 text-[#263028]">ADMIN</span>
            </button>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border select-none cursor-default ${
                autopilot
                  ? 'bg-[#E8EFE9]/80 text-[#263028] border-[#758F79]/40'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Atención de llamadas de seguimiento gestionada por el administrador (ggomez@elogia.com.co)"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <Activity className={`w-3.5 h-3.5 ${autopilot ? 'text-[#5F7663]' : 'text-slate-400'}`} />
              <span>Seguimiento: <strong className={autopilot ? 'text-[#4B5E4F]' : 'text-slate-500'}>{autopilot ? 'ACTIVO' : 'MANUAL'}</strong></span>
            </div>
          )}

          {/* 2. Alertas Críticas (Notificaciones a Telegram de Fuera de Ruta, Zonas Prohibidas, Excesos) */}
          {isAdmin ? (
            <button
              onClick={onToggleAlertas}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                alertasActivas
                  ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-xs hover:bg-rose-100'
                  : 'bg-white text-slate-600 border-[#D2DFD4] hover:bg-[#F5F8F5]'
              }`}
              title="Alertas automáticas a Telegram por Fuera de ruta, Zonas prohibidas y Excesos de velocidad (Exclusivo Administrador)"
            >
              <Bell className={`w-3.5 h-3.5 ${alertasActivas ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
              <span>Alertas: <strong className={alertasActivas ? 'text-rose-700' : 'text-slate-500'}>{alertasActivas ? 'ACTIVAS' : 'PAUSA'}</strong></span>
              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-200 text-rose-900">ADMIN</span>
            </button>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border select-none cursor-default ${
                alertasActivas
                  ? 'bg-rose-50/80 text-rose-900 border-rose-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Alertas críticas gestionadas por el administrador (ggomez@elogia.com.co)"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <Bell className={`w-3.5 h-3.5 ${alertasActivas ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Alertas: <strong className={alertasActivas ? 'text-rose-700' : 'text-slate-500'}>{alertasActivas ? 'ACTIVAS' : 'PAUSA'}</strong></span>
            </div>
          )}

          {/* Botón Gestión Usuarios [ADMIN] */}
          {isAdmin && onOpenUserManagement && (
            <button
              onClick={onOpenUserManagement}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F5F8F5] border border-[#B4C7B7] text-[#263028] hover:bg-[#E8EFE9] transition-all cursor-pointer shadow-2xs"
              title="Panel de administración de usuarios y operadores"
            >
              <Users className="w-3.5 h-3.5 text-[#5F7663]" />
              <span>Gestión Usuarios</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#5F7663] text-white text-[9px] font-bold">ADMIN</span>
            </button>
          )}

          {/* Copiloto ToCIE (Chat Operativo) */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5F7663] hover:bg-[#4B5E4F] text-white shadow-xs transition-all"
            title="Abrir Copiloto de Tráfico ToCIE"
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            <span>Copiloto ToCIE</span>
          </button>

          {/* Refrescar Datos */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#4B5E4F] hover:text-[#263028] hover:bg-[#E8EFE9] transition-all border border-[#D2DFD4]"
            title="Sincronizar telemetría en tiempo real"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Perfil del Operador y Salir */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#D2DFD4]">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-[11px] font-bold text-[#263028] leading-tight">
                  {currentUser.name || currentUser.username}
                </span>
                <span className="text-[10px] text-[#5F7663] leading-tight font-medium">
                  {isAdmin ? '👑 Administrador' : 'Operador ControlT'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-all border border-[#D2DFD4] hover:border-rose-200"
                title="Cerrar sesión de ControlT"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
