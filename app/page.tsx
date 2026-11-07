'use client';

import React, { useState, useEffect } from 'react';
import { Viaje, Alarma, ResumenMetricas } from '@/types';
import { Navbar } from '@/components/Navbar';
import { KpiCards } from '@/components/KpiCards';
import { ReportsView } from '@/components/ReportsView';
import { TrafficChat } from '@/components/TrafficChat';
import { LoginForm } from '@/components/LoginForm';
import { UserManagementModal } from '@/components/UserManagementModal';
import { Sparkles, Bot, MessageSquare, RefreshCw } from 'lucide-react';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{ username: string; name?: string; role?: string; rol?: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  const [metricas, setMetricas] = useState<ResumenMetricas>({
    totalViajes: 161,
    aTiempo: 116,
    tarde: 39,
    tolerancia: 3,
    sinCalculo: 3,
    totalAlarmas: 47,
    alarmasCriticas: 2,
    alarmasAltas: 45,
    alarmasBajas: 0,
    alarmasAtendidasHoy: 2,
  });

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [alarmas, setAlarmas] = useState<Alarma[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [autopilot, setAutopilot] = useState(false);
  const [alertasActivas, setAlertasActivas] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Carga inicial de datos
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resSummary, resAlarms] = await Promise.all([
        fetch('/api/controlt/summary'),
        fetch('/api/controlt/alarms')
      ]);

      const dataSummary = await resSummary.json();
      const dataAlarms = await resAlarms.json();

      if (dataSummary.success) {
        setMetricas(dataSummary.metricas);
        setViajes(dataSummary.viajes);
        setIsLive(Boolean(dataSummary.live));
      }
      if (dataAlarms.success) {
        setAlarmas(dataAlarms.alarmas);
        setHistorial(dataAlarms.historial || []);
      }

      // 3. Sincronizar estado global del Piloto y Alertas desde MySQL
      try {
        const resConfig = await fetch('/api/admin/config');
        const dataConfig = await resConfig.json();
        if (dataConfig.success && dataConfig.config) {
          setAutopilot((dataConfig.config.piloto_seguimiento || dataConfig.config.piloto_automatico) === 'ACTIVO');
          setAlertasActivas(dataConfig.config.alertas_seguridad === 'ACTIVO' || dataConfig.config.alertas_telegram === '1');
        }
      } catch (e) {}
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar sesión existente al cargar la página
  useEffect(() => {
    const checkAuth = async () => {
      // 1. Lectura rápida de localStorage para evitar parpadeos
      try {
        const saved = localStorage.getItem('ct_user_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.username) {
            setCurrentUser(parsed);
          }
        }
      } catch (e) {}

      // 2. Validación en servidor (/api/auth/me)
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('ct_user_session', JSON.stringify(data.user));
          loadData();
        } else {
          setCurrentUser(null);
          localStorage.removeItem('ct_user_session');
        }
      } catch (e) {
        // En caso de error de red, mantener sesión local si existía
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('ct_user_session');
    setCurrentUser(null);
  };

  // Conmutar el Piloto de Seguimiento globalmente en MySQL (Solo Administrador)
  const handleToggleAutopilot = async () => {
    const isAdmin = currentUser?.username?.toLowerCase().trim() === 'ggomez@elogia.com.co' || currentUser?.rol === 'ADMIN';
    if (!isAdmin) {
      alert('🔒 Solo un administrador tiene permiso para activar o pausar el Piloto de Seguimiento.');
      return;
    }

    const nextState = !autopilot ? 'ACTIVO' : 'MANUAL';
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: 'piloto_seguimiento',
          valor: nextState,
          updates: {
            piloto_seguimiento: nextState,
            piloto_automatico: nextState,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAutopilot(nextState === 'ACTIVO');
      } else {
        alert(data.error || 'No se pudo actualizar el estado');
      }
    } catch (err) {
      console.error('Error al alternar piloto de seguimiento:', err);
    }
  };

  // Conmutar las Alertas Críticas de Seguridad globalmente en MySQL (Solo Administrador)
  const handleToggleAlertas = async () => {
    const isAdmin = currentUser?.username?.toLowerCase().trim() === 'ggomez@elogia.com.co' || currentUser?.rol === 'ADMIN';
    if (!isAdmin) {
      alert('🔒 Solo un administrador tiene permiso para activar o pausar las Alertas Críticas.');
      return;
    }

    const nextState = !alertasActivas ? 'ACTIVO' : 'PAUSA';
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: 'alertas_seguridad',
          valor: nextState,
          updates: {
            alertas_seguridad: nextState,
            alertas_telegram: nextState === 'ACTIVO' ? '1' : '0',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertasActivas(nextState === 'ACTIVO');
      } else {
        alert(data.error || 'No se pudo actualizar las alertas');
      }
    } catch (err) {
      console.error('Error al alternar alertas de seguridad:', err);
    }
  };

  // Piloto automático: ejecuta cada 30 segundos si está activo
  useEffect(() => {
    if (!autopilot) return;

    const interval = setInterval(() => {
      handleAttendBatch();
    }, 30000);

    return () => clearInterval(interval);
  }, [autopilot]);

  // Atender una sola alarma con el flujo IA
  const handleAttendSingle = async (alarma: Alarma) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/controlt/attend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alarmaId: alarma.id,
          novedad: 'En ruta sin novedad alguna',
          comentario: `Vehículo en tránsito normal a ${alarma.velocidadKmh} km/h en ${alarma.ubicacion}. Ruta sin novedad alguna.`,
          atendidaPor: 'Agente Web UI',
        }),
      });

      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Error al atender alarma:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Atender lote completo de viajes a tiempo
  const handleAttendBatch = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/controlt/attend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'BATCH_ON_TIME',
          atendidaPor: 'Agente Piloto Automático',
        }),
      });

      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Error al atender lote:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F0F4F1] flex flex-col items-center justify-center p-4 text-[#263028]">
        <img 
          src="/logo-elogia.png" 
          alt="Elogia Soluciones Logísticas" 
          className="h-12 w-auto object-contain mb-4" 
        />
        <RefreshCw className="w-6 h-6 text-[#5F7663] animate-spin mb-3" />
        <p className="text-xs text-[#5F7663] font-semibold">Cargando Torre de Control Inteligente Elogia (ToCIE)...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginForm
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F7]">
      
      {/* Navbar Superior */}
      <Navbar
        autopilot={autopilot}
        onToggleAutopilot={handleToggleAutopilot}
        alertasActivas={alertasActivas}
        onToggleAlertas={handleToggleAlertas}
        onRefresh={loadData}
        isLoading={isLoading}
        onOpenChat={() => setIsChatOpen(true)}
        isLive={isLive}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Barra Ejecutiva Superior de la Torre de Control */}
        <div className="mb-5 bg-white border border-[#D2DFD4] p-4 sm:p-5 rounded-xl shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#E8EFE9] border border-[#CBD7CE] rounded-xl hidden sm:flex items-center justify-center">
              <img 
                src="/logo-elogia.png" 
                alt="Elogia" 
                className="h-8 w-auto object-contain" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-[#263028] text-white">
                  ToCIE v2.5
                </span>
                <span className="text-xs text-[#5F7663] font-medium">
                  Torre de Control Inteligente Elogia
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#263028] tracking-tight mt-0.5">
                Consola Central de Operaciones y Tráfico de Carga Pesada
              </h2>
              <p className="text-[11px] text-[#5F7663] font-medium mt-0.5">
                Supervisión de puntualidad en tiempo real, control de geocercas y gestión de alarmas sincronizada con ControlT Tower.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsChatOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#5F7663] hover:bg-[#4B5E4F] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Consultar Copiloto ToCIE</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Resumen */}
        <KpiCards
          metricas={metricas}
          onFilterSemaforo={() => {}}
          onFilterPrioridad={() => {}}
        />

        {/* Tablas de Reporte y Cola del Agente */}
        <ReportsView
          viajes={viajes}
          alarmas={alarmas}
          historial={historial}
          onAttendSingle={handleAttendSingle}
          onAttendBatch={handleAttendBatch}
          isProcessing={isProcessing}
        />

      </main>

      {/* Botón Flotante Discreto del Copiloto ToCIE */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-[#263028] hover:bg-[#39473C] text-white shadow-lg border border-[#5F7663] transition-all flex items-center gap-2.5 cursor-pointer group"
          title="Abrir Copiloto de Tráfico ToCIE"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">Copiloto ToCIE</span>
        </button>
      )}

      {/* Drawer del Agente Conversacional */}
      <TrafficChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onActionComplete={loadData}
      />

      {/* Modal de Gestión de Usuarios (Exclusivo Administrador) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUser={currentUser}
      />

    </div>
  );
}
