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
        className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Viajes</span>
          <Truck className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold text-slate-900">{metricas.totalViajes}</div>
        <div className="text-[11px] text-slate-500 mt-1">100% flota activa</div>
      </div>

      {/* 2. A Tiempo */}
      <div 
        onClick={() => onFilterSemaforo('A_TIEMPO')}
        className="cursor-pointer bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-sm hover:border-emerald-300 transition-all"
      >
        <div className="flex items-center justify-between text-emerald-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">A Tiempo</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold text-emerald-900">{metricas.aTiempo}</div>
        <div className="text-[11px] text-emerald-700 font-medium mt-1">72.0% del total</div>
      </div>

      {/* 3. Tarde */}
      <div 
        onClick={() => onFilterSemaforo('TARDE')}
        className="cursor-pointer bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 shadow-sm hover:border-rose-300 transition-all"
      >
        <div className="flex items-center justify-between text-rose-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Con Retraso</span>
          <Clock className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-2xl font-bold text-rose-900">{metricas.tarde}</div>
        <div className="text-[11px] text-rose-700 font-medium mt-1">24.2% del total</div>
      </div>

      {/* 4. Alarmas Críticas */}
      <div 
        onClick={() => onFilterPrioridad('CRITICA')}
        className="cursor-pointer bg-red-50/70 p-4 rounded-xl border border-red-300 shadow-sm hover:border-red-400 transition-all"
      >
        <div className="flex items-center justify-between text-red-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Críticas</span>
          <AlertOctagon className="w-4 h-4 text-red-600 animate-pulse" />
        </div>
        <div className="text-2xl font-bold text-red-900">{metricas.alarmasCriticas}</div>
        <div className="text-[11px] text-red-700 font-medium mt-1">Fuera de ruta</div>
      </div>

      {/* 5. Alarmas Altas */}
      <div 
        onClick={() => onFilterPrioridad('ALTA')}
        className="cursor-pointer bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-sm hover:border-amber-300 transition-all"
      >
        <div className="flex items-center justify-between text-amber-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Altas</span>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-2xl font-bold text-amber-900">{metricas.alarmasAltas}</div>
        <div className="text-[11px] text-amber-700 font-medium mt-1">Seguimientos pendientes</div>
      </div>

      {/* 6. Atendidas Hoy por IA */}
      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 shadow-sm">
        <div className="flex items-center justify-between text-indigo-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Atendidas IA</span>
          <Bot className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="text-2xl font-bold text-indigo-900">{metricas.alarmasAtendidasHoy}</div>
        <div className="text-[11px] text-indigo-700 font-medium mt-1">Gestiones exitosas</div>
      </div>

    </div>
  );
};

