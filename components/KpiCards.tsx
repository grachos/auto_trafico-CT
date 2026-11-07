'use client';

import React from 'react';
import { ResumenMetricas } from '@/types';
import { Truck, CheckCircle2, Clock, AlertTriangle, AlertOctagon, Bot } from 'lucide-react';

interface KpiCardsProps {
  metricas: ResumenMetricas;
  onFilterSemaforo: (filtro: string) => void;
  onFilterPrioridad: (filtro: string) => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  metricas,
  onFilterSemaforo,
  onFilterPrioridad,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
      
      {/* 1. Total Viajes */}
      <div 
        onClick={() => onFilterSemaforo('TODOS')}
        className="cursor-pointer bg-white p-3.5 rounded-xl border border-[#D2DFD4] shadow-2xs hover:border-[#758F79] hover:bg-[#F5F8F5] transition-all"
      >
        <div className="flex items-center justify-between text-[#5F7663] mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">Flota Activa</span>
          <Truck className="w-3.5 h-3.5 text-[#5F7663]" />
        </div>
        <div className="text-2xl font-extrabold text-[#263028]">{metricas.totalViajes}</div>
        <div className="text-[10px] text-[#5F7663] font-medium mt-0.5">100% viajes monitoreados</div>
      </div>

      {/* 2. A Tiempo */}
      <div 
        onClick={() => onFilterSemaforo('A_TIEMPO')}
        className="cursor-pointer bg-[#F1F8F2] p-3.5 rounded-xl border border-[#C8E6C9] shadow-2xs hover:border-emerald-500 transition-all"
      >
        <div className="flex items-center justify-between text-emerald-800 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">A Tiempo</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        </div>
        <div className="text-2xl font-extrabold text-emerald-950">{metricas.aTiempo}</div>
        <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
          {metricas.totalViajes > 0 ? `${Math.round((metricas.aTiempo / metricas.totalViajes) * 100)}%` : '0%'} puntualidad
        </div>
      </div>

      {/* 3. Tarde */}
      <div 
        onClick={() => onFilterSemaforo('TARDE')}
        className="cursor-pointer bg-[#FFF4F4] p-3.5 rounded-xl border border-[#FFCDD2] shadow-2xs hover:border-rose-400 transition-all"
      >
        <div className="flex items-center justify-between text-rose-800 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">Con Retraso</span>
          <Clock className="w-3.5 h-3.5 text-rose-700" />
        </div>
        <div className="text-2xl font-extrabold text-rose-950">{metricas.tarde}</div>
        <div className="text-[10px] text-rose-800 font-semibold mt-0.5">
          {metricas.totalViajes > 0 ? `${Math.round((metricas.tarde / metricas.totalViajes) * 100)}%` : '0%'} de la flota
        </div>
      </div>

      {/* 4. Alarmas Críticas */}
      <div 
        onClick={() => onFilterPrioridad('CRITICA')}
        className="cursor-pointer bg-[#FFF0F0] p-3.5 rounded-xl border border-[#EF9A9A] shadow-2xs hover:border-red-500 transition-all"
      >
        <div className="flex items-center justify-between text-red-800 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">Críticas</span>
          <AlertOctagon className="w-3.5 h-3.5 text-red-700 animate-pulse" />
        </div>
        <div className="text-2xl font-extrabold text-red-950">{metricas.alarmasCriticas}</div>
        <div className="text-[10px] text-red-800 font-semibold mt-0.5">Fuera de ruta / Urgente</div>
      </div>

      {/* 5. Alarmas Altas */}
      <div 
        onClick={() => onFilterPrioridad('ALTA')}
        className="cursor-pointer bg-[#FFF8E7] p-3.5 rounded-xl border border-[#FFE082] shadow-2xs hover:border-amber-400 transition-all"
      >
        <div className="flex items-center justify-between text-amber-900 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">Seguimientos</span>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
        </div>
        <div className="text-2xl font-extrabold text-amber-950">{metricas.alarmasAltas}</div>
        <div className="text-[10px] text-amber-900 font-semibold mt-0.5">Llamadas pendientes</div>
      </div>

      {/* 6. Atendidas Hoy ToCIE */}
      <div className="bg-[#E8EFE9] p-3.5 rounded-xl border border-[#B4C7B7] shadow-2xs">
        <div className="flex items-center justify-between text-[#263028] mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">Atenciones ToCIE</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-[#5F7663]" />
        </div>
        <div className="text-2xl font-extrabold text-[#263028]">{metricas.alarmasAtendidasHoy}</div>
        <div className="text-[10px] text-[#4B5E4F] font-semibold mt-0.5">Gestiones cerradas hoy</div>
      </div>

    </div>
  );
};

