export type SemaforoETA = 'A_TIEMPO' | 'TARDE' | 'TOLERANCIA' | 'SIN_CALCULO';

export type PrioridadAlarma = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

export interface Viaje {
  id: string;
  nroViaje: string;
  placa: string;
  conductor: string;
  telefono?: string;
  cliente: string;
  origen: string;
  destino: string;
  citaProgramada: string;
  etaEstimada: string;
  semaforoETA: SemaforoETA;
  porcentajeRuta: number;
  velocidadKmh: number;
  ubicacion: string;
  ultimoEvento: string;
  novedadResumen?: string;
  estadoViaje: 'En Transíto' | 'Iniciado' | 'Descargando' | 'Completado';
}

export interface Alarma {
  id: string;
  prioridad: PrioridadAlarma;
  evento: string;
  nroViaje: string;
  placa: string;
  conductor: string;
  telefono?: string;
  cliente: string;
  fechaHora: string;
  ubicacion: string;
  velocidadKmh: number;
  semaforoETA: SemaforoETA;
  ultimoEventoResumen: string;
  estado: 'PENDIENTE' | 'ATENDIDA';
  novedadAplicada?: string;
  comentarioRegistrado?: string;
  atendidaPor?: string;
  fechaAtencion?: string;
}

export interface ResumenMetricas {
  totalViajes: number;
  aTiempo: number;
  tarde: number;
  tolerancia: number;
  sinCalculo: number;
  totalAlarmas: number;
  alarmasCriticas: number;
  alarmasAltas: number;
  alarmasBajas: number;
  alarmasAtendidasHoy: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  actionTaken?: {
    type: 'ATTEND_SINGLE' | 'ATTEND_BATCH' | 'GENERATE_REPORT' | 'FILTER';
    summary: string;
    affectedCount?: number;
    details?: any;
  };
}

