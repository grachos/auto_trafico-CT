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
  const [currentUser, setCurrentUser] = useState<{ username: string; name?: string; role?: string } | null>(null);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-xs text-slate-300 font-medium">Verificando sesión en ControlT...</p>
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* Navbar Superior */}
      <Navbar
        autopilot={autopilot}
        onToggleAutopilot={() => setAutopilot(!autopilot)}
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
        
        {/* Banner de Bienvenida y Estado del Agente */}
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Agente Autónomo de Tráfico Listo</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Monitoreo y Atención Desatendida ControlT</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              El agente cruza la telemetría en tiempo real con el semáforo ETA, analiza los últimos eventos y atiende de forma inteligente las llamadas de seguimiento. También puedes hablar con la IA en texto libre o conectarla con Telegram.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsChatOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Abrir Chat con la IA</span>
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

      {/* Floating Chat Trigger Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-500/30 hover:scale-105 transition-all flex items-center gap-2 group"
          title="Hablar con la IA de Tráfico"
        >
          <Bot className="w-6 h-6" />
          <span className="hidden sm:inline text-xs font-bold pr-1">Chatear con la IA</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute top-1 right-1 border-2 border-white animate-pulse" />
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
