'use client';

import React, { useState } from 'react';
import { Viaje, Alarma, PrioridadAlarma } from '@/types';
import { 
  Bot, 
  Sparkles, 
  Download, 
  Search, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  MapPin, 
  Gauge, 
  CheckCheck,
  ShieldAlert
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
  const [activeTab, setActiveTab] = useState<'COLA_AGENTE' | 'SEMAFORO_ETA' | 'PRIORIDADES' | 'MATRIZ_RIESGO' | 'HISTORIAL'>('COLA_AGENTE');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSemaforo, setFiltroSemaforo] = useState('TODOS');
  const [filtroPrioridad, setFiltroPrioridad] = useState('TODAS');

  // Filtrado de Viajes
  const filteredViajes = viajes.filter(v => {
    const matchesSearch = 
      v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.nroViaje.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.conductor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSemaforo = filtroSemaforo === 'TODOS' || v.semaforoETA === filtroSemaforo;
    return matchesSearch && matchesSemaforo;
  });

  // Filtrado de Alarmas
  const filteredAlarmas = alarmas.filter(a => {
    const matchesSearch = 
      a.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.nroViaje.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.conductor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.evento.toLowerCase().includes(searchTerm.toLowerCase());
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

    XLSX.writeFile(wb, `Reporte_ControlT_Trafico_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      
      {/* Tabs Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('COLA_AGENTE')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'COLA_AGENTE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Cola Agente IA ({alarmas.filter(a => a.estado === 'PENDIENTE').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SEMAFORO_ETA')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'SEMAFORO_ETA'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Reporte Semáforo ETA ({viajes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PRIORIDADES')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PRIORIDADES'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Alarmas por Prioridad</span>
          </button>

          <button
            onClick={() => setActiveTab('MATRIZ_RIESGO')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'MATRIZ_RIESGO'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Matriz de Riesgo</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORIAL')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'HISTORIAL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            <span>Bitácora ({historial.length})</span>
          </button>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar placa, viaje, chofer..."
              className="bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all shadow-sm"
            title="Descargar libro Excel con todas las hojas"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>

      </div>

      {/* TAB 1: COLA AGENTE IA */}
      {activeTab === 'COLA_AGENTE' && (
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <div className="flex items-center gap-2 text-indigo-900 text-xs font-medium">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>
                El agente identifica los viajes con semáforo **A tiempo** y atiende las llamadas de seguimiento según su último evento.
              </span>
            </div>

            <button
              onClick={onAttendBatch}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" />
              <span>{isProcessing ? 'Procesando lote...' : '⚡ Atender Todas a Tiempo (Batch)'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Prioridad</th>
                  <th className="p-3">Viaje / Placa</th>
                  <th className="p-3">Conductor</th>
                  <th className="p-3">Evento Alarma</th>
                  <th className="p-3">Semáforo ETA</th>
                  <th className="p-3">Telemetría</th>
                  <th className="p-3">Último Evento Resumen</th>
                  <th className="p-3 text-right">Acción Agente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAlarmas.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-all">
                    
                    {/* Prioridad */}
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        a.prioridad === 'CRITICA'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : a.prioridad === 'ALTA'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {a.prioridad}
                      </span>
                    </td>

                    {/* Viaje & Placa */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{a.placa}</div>
                      <div className="text-[11px] text-slate-400">{a.nroViaje}</div>
                    </td>

                    {/* Conductor */}
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{a.conductor}</div>
                      {a.telefono && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {a.telefono}
                        </div>
                      )}
                    </td>

                    {/* Evento */}
                    <td className="p-3 font-semibold text-slate-900">{a.evento}</td>

                    {/* Semáforo ETA */}
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        a.semaforoETA === 'A_TIEMPO'
                          ? 'bg-emerald-100/70 text-emerald-800'
                          : 'bg-rose-100/70 text-rose-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${a.semaforoETA === 'A_TIEMPO' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {a.semaforoETA === 'A_TIEMPO' ? 'A Tiempo' : 'Retrasado'}
                      </span>
                    </td>

                    {/* Telemetría */}
                    <td className="p-3">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <Gauge className="w-3 h-3 text-slate-400" />
                        {a.velocidadKmh} km/h
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{a.ubicacion}</div>
                    </td>

                    {/* Último Evento */}
                    <td className="p-3">
                      <div className="text-slate-800 max-w-[200px] truncate font-medium">{a.ultimoEventoResumen}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold">Sugerido: En ruta sin novedad alguna</div>
                    </td>

                    {/* Acción */}
                    <td className="p-3 text-right">
                      {a.semaforoETA === 'A_TIEMPO' ? (
                        <button
                          onClick={() => onAttendSingle(a)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm"
                        >
                          Atender con IA
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                          📞 Gestión Humana
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

      {/* TAB 2: SEMÁFORO ETA */}
      {activeTab === 'SEMAFORO_ETA' && (
        <div className="p-4">
          
          {/* Subfiltros Semáforo */}
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
            <span className="text-slate-500">Filtrar por estado:</span>
            {['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA'].map(st => (
              <button
                key={st}
                onClick={() => setFiltroSemaforo(st)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filtroSemaforo === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'TODOS' ? 'Todos (161)' : st === 'A_TIEMPO' ? '🟢 A Tiempo (116)' : st === 'TARDE' ? '🔴 Tarde (39)' : '🟡 Tolerancia (3)'}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Semáforo</th>
                  <th className="p-3">Viaje / Placa</th>
                  <th className="p-3">Conductor</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Ruta</th>
                  <th className="p-3">Cita vs ETA Estimada</th>
                  <th className="p-3">% Avance</th>
                  <th className="p-3">Último Evento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredViajes.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-all">
                    
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        v.semaforoETA === 'A_TIEMPO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${v.semaforoETA === 'A_TIEMPO' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {v.semaforoETA === 'A_TIEMPO' ? 'A Tiempo' : 'Retrasado'}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900">{v.placa}</div>
                      <div className="text-[11px] text-slate-400">{v.nroViaje}</div>
                    </td>

                    <td className="p-3 font-medium text-slate-800">{v.conductor}</td>
                    <td className="p-3 font-semibold text-slate-700">{v.cliente}</td>
                    <td className="p-3 text-slate-600">{v.origen} &rarr; {v.destino}</td>

                    <td className="p-3">
                      <div className="text-slate-500 text-[11px]">Cita: {v.citaProgramada}</div>
                      <div className="font-bold text-slate-900">ETA: {v.etaEstimada}</div>
                    </td>

                    <td className="p-3">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden mb-1">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${v.porcentajeRuta}%` }} />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600">{v.porcentajeRuta}%</div>
                    </td>

                    <td className="p-3 text-slate-600 max-w-[220px] truncate">{v.ultimoEvento}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: ALARMAS POR PRIORIDAD */}
      {activeTab === 'PRIORIDADES' && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
            <span className="text-slate-500">Filtrar por prioridad:</span>
            {['TODAS', 'CRITICA', 'ALTA', 'BAJA'].map(pr => (
              <button
                key={pr}
                onClick={() => setFiltroPrioridad(pr)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filtroPrioridad === pr
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pr}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">ID Alarma</th>
                  <th className="p-3">Nivel</th>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Vehículo / Viaje</th>
                  <th className="p-3">Conductor & Teléfono</th>
                  <th className="p-3">Ubicación GPS</th>
                  <th className="p-3">Velocidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAlarmas.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-3 font-mono font-bold text-slate-600">{a.id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        a.prioridad === 'CRITICA' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {a.prioridad}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">{a.evento}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{a.placa}</div>
                      <div className="text-[11px] text-slate-400">{a.nroViaje}</div>
                    </td>
                    <td className="p-3">
                      <div>{a.conductor}</div>
                      <div className="text-[11px] text-slate-400">{a.telefono}</div>
                    </td>
                    <td className="p-3 text-slate-600">{a.ubicacion}</td>
                    <td className="p-3 font-bold text-slate-800">{a.velocidadKmh} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MATRIZ DE RIESGO */}
      {activeTab === 'MATRIZ_RIESGO' && (
        <div className="p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Matriz de Decisión Operativa</h3>
          <p className="text-xs text-slate-500 mb-6">Segregación inteligente entre atenciones automáticas de IA y escalamiento a supervisores.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Cuadrante 1: Agente IA */}
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>🟢 Flujo Agente Automático (IA)</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed mb-4">
                Viajes en estado **A TIEMPO** con alarmas de seguimiento rutinarias. El Agente consulta el último evento en resumen, asigna novedad y cierra la alarma sin requerir intervención manual.
              </p>
              <div className="text-xs font-semibold text-emerald-900 bg-white/70 p-3 rounded-xl border border-emerald-200">
                • Total candidatos en cola: **{alarmas.filter(a => a.semaforoETA === 'A_TIEMPO' && a.estado === 'PENDIENTE').length} vehículos**<br/>
                • Tiempo promedio de atención: **0.8 segundos / alarma**
              </div>
            </div>

            {/* Cuadrante 2: Intervención Humana */}
            <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm mb-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <span>🚨 Intervención Humana Requerida</span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed mb-4">
                Viajes en estado **TARDE** con citas en riesgo o eventos **CRÍTICOS** (Fuera de ruta, pánico). Requieren llamada telefónica inmediata al conductor y comunicación con el cliente.
              </p>
              <div className="text-xs font-semibold text-rose-900 bg-white/70 p-3 rounded-xl border border-rose-200">
                • Casos críticos activos: **2 unidades** (PPQ455, SVM983)<br/>
                • Viajes con retraso severo: **39 unidades**
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 5: HISTORIAL Y BITÁCORA */}
      {activeTab === 'HISTORIAL' && (
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Viaje / Placa</th>
                  <th className="p-3">Novedad Registrada</th>
                  <th className="p-3">Comentario Guardado en ControlT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {historial.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-3 font-mono text-slate-500">{h.fecha}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900">{h.placa}</span>
                      <span className="text-slate-400 text-[11px] block">{h.viaje}</span>
                    </td>
                    <td className="p-3">
                      <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                        {h.novedad}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 italic max-w-md">{h.comentario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

