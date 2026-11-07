'use client';

import React, { useState } from 'react';
import { Viaje, Alarma, PrioridadAlarma } from '@/types';
import { 
  Download, 
  Search, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Gauge, 
  CheckCheck,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Zap,
  ListOrdered
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  viajes: Viaje[];
  alarmas: Alarma[];
  historial: any[];
  onAttendSingle: (alarma: Alarma) => void;
  onAttendBatch: () => void;
  isProcessing: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  viajes,
  alarmas,
  historial,
  onAttendSingle,
  onAttendBatch,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<'SEMAFORO_ETA' | 'ALARMAS' | 'GESTION_AUTO' | 'MATRIZ_RIESGO' | 'HISTORIAL'>('SEMAFORO_ETA');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSemaforo, setFiltroSemaforo] = useState('TODOS');
  const [filtroPrioridad, setFiltroPrioridad] = useState('TODAS');

  // Filtrado de Viajes
  const filteredViajes = viajes.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      v.placa.toLowerCase().includes(term) ||
      v.nroViaje.toLowerCase().includes(term) ||
      v.conductor.toLowerCase().includes(term) ||
      v.cliente.toLowerCase().includes(term);
    const matchesSemaforo = filtroSemaforo === 'TODOS' || v.semaforoETA === filtroSemaforo;
    return matchesSearch && matchesSemaforo;
  });

  // Filtrado de Alarmas
  const filteredAlarmas = alarmas.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      a.placa.toLowerCase().includes(term) ||
      a.nroViaje.toLowerCase().includes(term) ||
      a.conductor.toLowerCase().includes(term) ||
      a.evento.toLowerCase().includes(term);
    const matchesPrioridad = filtroPrioridad === 'TODAS' || a.prioridad === filtroPrioridad;
    return matchesSearch && matchesPrioridad;
  });

  // Exportar reporte consolidado a Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Semáforo ETA
    const wsViajes = XLSX.utils.json_to_sheet(
      viajes.map(v => ({
        'N° Viaje': v.nroViaje,
        'Placa': v.placa,
        'Conductor': v.conductor,
        'Cliente': v.cliente,
        'Ruta': `${v.origen} -> ${v.destino}`,
        'Cita Programada': v.citaProgramada,
        'ETA Calculada': v.etaEstimada,
        'Semáforo ETA': v.semaforoETA,
        '% Avance': `${v.porcentajeRuta}%`,
        'Velocidad (km/h)': v.velocidadKmh,
        'Ubicación': v.ubicacion,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsViajes, 'Semáforo ETA');

    // Hoja 2: Alarmas Activas
    const wsAlarmas = XLSX.utils.json_to_sheet(
      alarmas.map(a => ({
        'ID Alarma': a.id,
        'Prioridad': a.prioridad,
        'Evento': a.evento,
        'N° Viaje': a.nroViaje,
        'Placa': a.placa,
        'Conductor': a.conductor,
        'Teléfono': a.telefono || 'N/A',
        'Cliente': a.cliente,
        'Velocidad (km/h)': a.velocidadKmh,
        'Ubicación': a.ubicacion,
        'Semáforo ETA': a.semaforoETA,
        'Estado': a.estado,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsAlarmas, 'Alarmas por Prioridad');

    // Hoja 3: Bitácora de Atenciones
    const wsHistorial = XLSX.utils.json_to_sheet(historial);
    XLSX.utils.book_append_sheet(wb, wsHistorial, 'Bitácora Atenciones');

    XLSX.writeFile(wb, `ToCIE_Elogia_ControlT_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl border border-[#D2DFD4] shadow-xs overflow-hidden">
      
      {/* Tabs Header Estilo ControlT Enterprise */}
      <div className="p-3 sm:p-4 border-b border-[#D2DFD4] bg-[#F7F9F7] flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          
          {/* Tab 1: Resumen de Flota / Semáforo ETA */}
          <button
            onClick={() => setActiveTab('SEMAFORO_ETA')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'SEMAFORO_ETA'
                ? 'bg-[#5F7663] text-white shadow-xs font-bold'
                : 'text-[#39473C] hover:bg-[#E8EFE9] hover:text-[#263028]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Resumen Flota ETA</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'SEMAFORO_ETA' ? 'bg-white/20 text-white' : 'bg-[#D2DFD4] text-[#263028]'
            }`}>
              {viajes.length}
            </span>
          </button>

          {/* Tab 2: Alarmas por Atender */}
          <button
            onClick={() => setActiveTab('ALARMAS')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ALARMAS'
                ? 'bg-[#5F7663] text-white shadow-xs font-bold'
                : 'text-[#39473C] hover:bg-[#E8EFE9] hover:text-[#263028]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alarmas Pendientes</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'ALARMAS' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {alarmas.filter(a => a.estado === 'PENDIENTE').length}
            </span>
          </button>

          {/* Tab 3: Gestión Automática / Lote */}
          <button
            onClick={() => setActiveTab('GESTION_AUTO')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'GESTION_AUTO'
                ? 'bg-[#5F7663] text-white shadow-xs font-bold'
                : 'text-[#39473C] hover:bg-[#E8EFE9] hover:text-[#263028]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Gestión Automática</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'GESTION_AUTO' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {alarmas.filter(a => a.semaforoETA === 'A_TIEMPO' && a.estado === 'PENDIENTE').length}
            </span>
          </button>

          {/* Tab 4: Matriz de Riesgo */}
          <button
            onClick={() => setActiveTab('MATRIZ_RIESGO')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'MATRIZ_RIESGO'
                ? 'bg-[#5F7663] text-white shadow-xs font-bold'
                : 'text-[#39473C] hover:bg-[#E8EFE9] hover:text-[#263028]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Matriz Operativa</span>
          </button>

          {/* Tab 5: Bitácora y Auditoría */}
          <button
            onClick={() => setActiveTab('HISTORIAL')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'HISTORIAL'
                ? 'bg-[#5F7663] text-white shadow-xs font-bold'
                : 'text-[#39473C] hover:bg-[#E8EFE9] hover:text-[#263028]'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Bitácora ({historial.length})</span>
          </button>
        </div>

        {/* Global Search & Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar placa, viaje, cliente..."
              className="bg-white border border-[#CBD7CE] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#263028] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#758F79] w-40 sm:w-52"
            />
          </div>

          <a
            href="/api/reportes/tabla"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD7CE] bg-white text-[#263028] hover:bg-[#E8EFE9] text-xs font-semibold transition-all shadow-2xs"
            title="Abrir planilla completa en pestaña nueva para imprimir o guardar PDF"
          >
            <FileText className="w-3.5 h-3.5 text-[#5F7663]" />
            <span className="hidden sm:inline">Planilla / PDF</span>
          </a>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD7CE] bg-white text-[#263028] hover:bg-[#E8EFE9] text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="Descargar libro Excel con todas las hojas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Exportar XLS</span>
          </button>
        </div>

      </div>

      {/* VISTA 1: SEMÁFORO ETA Y RESUMEN DE FLOTA */}
      {activeTab === 'SEMAFORO_ETA' && (
        <div className="p-4">
          
          {/* Subfiltros Semáforo */}
          <div className="flex items-center gap-2 mb-3.5 text-xs font-semibold flex-wrap">
            <span className="text-[#5F7663]">Filtro de Semáforo:</span>
            {[
              { id: 'TODOS', label: `Todos (${viajes.length})` },
              { id: 'A_TIEMPO', label: `🟢 A Tiempo (${viajes.filter(v => v.semaforoETA === 'A_TIEMPO').length})` },
              { id: 'TARDE', label: `🔴 Con Retraso (${viajes.filter(v => v.semaforoETA === 'TARDE').length})` },
              { id: 'TOLERANCIA', label: `🟡 Tolerancia (${viajes.filter(v => v.semaforoETA === 'TOLERANCIA').length})` },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setFiltroSemaforo(st.id)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  filtroSemaforo === st.id
                    ? 'bg-[#263028] text-white font-bold'
                    : 'bg-[#F0F4F1] text-[#39473C] hover:bg-[#E8EFE9] border border-[#D2DFD4]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto border border-[#E8EFE9] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F9F7] text-[#263028] font-bold border-b border-[#D2DFD4] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Semáforo</th>
                  <th className="p-2.5">Placa / Viaje</th>
                  <th className="p-2.5">Conductor</th>
                  <th className="p-2.5">Cliente Generador</th>
                  <th className="p-2.5">Ruta</th>
                  <th className="p-2.5">Cita vs ETA Estimada</th>
                  <th className="p-2.5 text-center">% Avance</th>
                  <th className="p-2.5">Último Evento GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EFE9] text-[#263028]">
                {filteredViajes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#5F7663]">
                      No se encontraron viajes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredViajes.map(v => (
                    <tr key={v.id} className="hover:bg-[#F5F8F5] transition-colors">
                      
                      <td className="p-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.semaforoETA === 'A_TIEMPO'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : v.semaforoETA === 'TARDE'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            v.semaforoETA === 'A_TIEMPO' ? 'bg-emerald-600' : v.semaforoETA === 'TARDE' ? 'bg-rose-600' : 'bg-amber-500'
                          }`} />
                          {v.semaforoETA === 'A_TIEMPO' ? 'A Tiempo' : v.semaforoETA === 'TARDE' ? 'Retrasado' : 'Tolerancia'}
                        </span>
                      </td>

                      <td className="p-2.5">
                        <div className="font-bold text-[#263028]">{v.placa}</div>
                        <div className="text-[10px] text-[#5F7663]">{v.nroViaje}</div>
                      </td>

                      <td className="p-2.5">
                        <div className="font-semibold text-[#263028]">{v.conductor}</div>
                        {v.telefono && (
                          <div className="text-[10px] text-[#5F7663] flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> {v.telefono}
                          </div>
                        )}
                      </td>

                      <td className="p-2.5 font-medium text-[#39473C] truncate max-w-[180px]">{v.cliente}</td>
                      <td className="p-2.5 text-[#39473C] whitespace-nowrap">{v.origen} &rarr; {v.destino}</td>

                      <td className="p-2.5">
                        <div className="text-[#5F7663] text-[10px]">Cita: {v.citaProgramada}</div>
                        <div className="font-bold text-[#263028]">ETA: {v.etaEstimada}</div>
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="w-16 bg-[#E8EFE9] h-1.5 rounded-full overflow-hidden mb-1 mx-auto">
                          <div className="bg-[#5F7663] h-full rounded-full" style={{ width: `${v.porcentajeRuta}%` }} />
                        </div>
                        <div className="text-[10px] font-bold text-[#5F7663]">{v.porcentajeRuta}%</div>
                      </td>

                      <td className="p-2.5 text-[#39473C] max-w-[220px] truncate text-[11px]">{v.ultimoEvento}</td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VISTA 2: ALARMAS POR ATENDER */}
      {activeTab === 'ALARMAS' && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3.5 text-xs font-semibold flex-wrap">
            <span className="text-[#5F7663]">Filtrar por Severidad:</span>
            {['TODAS', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'].map(pr => (
              <button
                key={pr}
                onClick={() => setFiltroPrioridad(pr)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  filtroPrioridad === pr
                    ? 'bg-[#263028] text-white font-bold'
                    : 'bg-[#F0F4F1] text-[#39473C] hover:bg-[#E8EFE9] border border-[#D2DFD4]'
                }`}
              >
                {pr}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto border border-[#E8EFE9] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F9F7] text-[#263028] font-bold border-b border-[#D2DFD4] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Severidad</th>
                  <th className="p-2.5">Evento</th>
                  <th className="p-2.5">Placa / Viaje</th>
                  <th className="p-2.5">Conductor</th>
                  <th className="p-2.5">Semáforo</th>
                  <th className="p-2.5">Telemetría</th>
                  <th className="p-2.5">Ubicación GPS</th>
                  <th className="p-2.5 text-right">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EFE9] text-[#263028]">
                {filteredAlarmas.map(a => (
                  <tr key={a.id} className="hover:bg-[#F5F8F5] transition-colors">
                    <td className="p-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        a.prioridad === 'CRITICA'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : a.prioridad === 'ALTA'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {a.prioridad}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-[#263028]">{a.evento}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-[#263028]">{a.placa}</div>
                      <div className="text-[10px] text-[#5F7663]">{a.nroViaje}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold">{a.conductor}</div>
                      {a.telefono && (
                        <div className="text-[10px] text-[#5F7663] flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" /> {a.telefono}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.semaforoETA === 'A_TIEMPO' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.semaforoETA === 'A_TIEMPO' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        {a.semaforoETA === 'A_TIEMPO' ? 'A Tiempo' : 'Retrasado'}
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-[#39473C]">
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-[#5F7663]" />
                        {a.velocidadKmh} km/h
                      </div>
                    </td>
                    <td className="p-2.5 text-[#39473C] truncate max-w-[200px] text-[11px]">{a.ubicacion}</td>
                    <td className="p-2.5 text-right">
                      {a.semaforoETA === 'A_TIEMPO' ? (
                        <button
                          onClick={() => onAttendSingle(a)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded-md bg-[#5F7663] hover:bg-[#4B5E4F] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                        >
                          Atender Alarma
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          📞 Escalar a Tráfico
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: GESTIÓN AUTOMÁTICA & LOTE */}
      {activeTab === 'GESTION_AUTO' && (
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3.5 bg-[#E8EFE9] border border-[#CBD7CE] rounded-xl">
            <div className="flex items-center gap-2.5 text-[#263028] text-xs font-medium">
              <Zap className="w-4 h-4 text-[#5F7663] shrink-0" />
              <span>
                ToCIE analiza las unidades con semáforo <strong>A Tiempo</strong>, captura su último evento GPS y atiende automáticamente las llamadas de seguimiento con la novedad oficial <em>"En ruta sin novedad alguna"</em>.
              </span>
            </div>

            <button
              onClick={onAttendBatch}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-lg bg-[#5F7663] hover:bg-[#4B5E4F] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Procesando lote...' : '⚡ Atender Seguimientos a Tiempo en Lote'}</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#E8EFE9] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F9F7] text-[#263028] font-bold border-b border-[#D2DFD4] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Placa / Viaje</th>
                  <th className="p-2.5">Conductor</th>
                  <th className="p-2.5">Evento</th>
                  <th className="p-2.5">Semáforo</th>
                  <th className="p-2.5">Telemetría</th>
                  <th className="p-2.5">Último Evento Resumen</th>
                  <th className="p-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EFE9] text-[#263028]">
                {filteredAlarmas.filter(a => a.semaforoETA === 'A_TIEMPO').map(a => (
                  <tr key={a.id} className="hover:bg-[#F5F8F5] transition-colors">
                    <td className="p-2.5">
                      <div className="font-bold text-[#263028]">{a.placa}</div>
                      <div className="text-[10px] text-[#5F7663]">{a.nroViaje}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-[#263028]">{a.conductor}</div>
                    </td>
                    <td className="p-2.5 font-bold text-[#39473C]">{a.evento}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        🟢 A Tiempo
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-[#39473C]">{a.velocidadKmh} km/h</td>
                    <td className="p-2.5 text-[#39473C] max-w-[220px] truncate text-[11px]">{a.ultimoEventoResumen}</td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onAttendSingle(a)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-md bg-[#5F7663] hover:bg-[#4B5E4F] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                      >
                        Atender
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 4: MATRIZ DE RIESGO OPERATIVO */}
      {activeTab === 'MATRIZ_RIESGO' && (
        <div className="p-6">
          <h3 className="text-sm font-bold text-[#263028] mb-1">Matriz de Clasificación Operativa</h3>
          <p className="text-xs text-[#5F7663] mb-6">Segregación inteligente entre atenciones automáticas de ToCIE y escalamiento a supervisores humanos de tráfico.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Cuadrante 1: Agente ToCIE */}
            <div className="p-5 rounded-xl bg-[#F1F8F2] border border-[#C8E6C9]">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>🟢 Gestión Automática ToCIE</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed mb-4">
                Viajes en estado <strong>A TIEMPO</strong> con llamadas de seguimiento rutinarias. ToCIE consulta la posición GPS y último evento, asigna <em>"En ruta sin novedad alguna"</em> y guarda directamente en ControlT.
              </p>
              <div className="text-xs font-semibold text-emerald-950 bg-white/80 p-3 rounded-lg border border-[#C8E6C9]">
                • Candidatos en cola: <strong>{alarmas.filter(a => a.semaforoETA === 'A_TIEMPO' && a.estado === 'PENDIENTE').length} unidades</strong><br/>
                • Tiempo promedio de atención: <strong>0.8 segundos / alarma</strong>
              </div>
            </div>

            {/* Cuadrante 2: Intervención Humana */}
            <div className="p-5 rounded-xl bg-[#FFF4F4] border border-[#FFCDD2]">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-sm mb-2">
                <AlertOctagon className="w-4 h-4 text-rose-700" />
                <span>🚨 Escalamiento a Operadores de Tráfico</span>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed mb-4">
                Viajes en estado <strong>TARDE</strong> o con eventos <strong>CRÍTICOS</strong> (Fuera de ruta, botón de pánico, desconexión prolongada). Requieren intervención telefónica con el conductor o cliente.
              </p>
              <div className="text-xs font-semibold text-rose-950 bg-white/80 p-3 rounded-lg border border-[#FFCDD2]">
                • Casos críticos activos: <strong>{alarmas.filter(a => a.prioridad === 'CRITICA').length} unidades</strong><br/>
                • Viajes con retraso en cita: <strong>{viajes.filter(v => v.semaforoETA === 'TARDE').length} unidades</strong>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VISTA 5: HISTORIAL Y BITÁCORA */}
      {activeTab === 'HISTORIAL' && (
        <div className="p-4">
          <div className="overflow-x-auto border border-[#E8EFE9] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F9F7] text-[#263028] font-bold border-b border-[#D2DFD4] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Fecha y Hora</th>
                  <th className="p-2.5">Placa / Viaje</th>
                  <th className="p-2.5">Novedad Registrada</th>
                  <th className="p-2.5">Comentario Guardado en ControlT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EFE9] text-[#263028]">
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[#5F7663]">
                      No hay registros en la bitácora para la sesión actual.
                    </td>
                  </tr>
                ) : (
                  historial.map(h => (
                    <tr key={h.id} className="hover:bg-[#F5F8F5] transition-colors">
                      <td className="p-2.5 font-mono text-[#5F7663] text-[11px]">{h.fecha}</td>
                      <td className="p-2.5">
                        <span className="font-bold text-[#263028]">{h.placa}</span>
                        <span className="text-[#5F7663] text-[10px] block">{h.viaje}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="bg-[#E8EFE9] text-[#263028] font-semibold px-2 py-0.5 rounded border border-[#CBD7CE] text-[10px]">
                          {h.novedad}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#39473C] italic max-w-md text-[11px]">{h.comentario}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};


