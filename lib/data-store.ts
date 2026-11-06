import { Viaje, Alarma, ResumenMetricas } from '@/types';

// Almacén en memoria persistente durante la ejecución del servidor
class DataStore {
  private viajes: Viaje[] = [];
  private alarmas: Alarma[] = [];
  private historialAtenciones: { id: string; alarmaId: string; viaje: string; placa: string; novedad: string; comentario: string; fecha: string }[] = [];

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Inicialización con los datos reales analizados en ControlT
    this.viajes = [
      {
        id: '1',
        nroViaje: '0101226422',
        placa: 'KNL064',
        conductor: 'JUAN GONZALEZ GUTIERREZ',
        telefono: '3104582910',
        cliente: 'PRIMAX COLOMBIA S.A.',
        origen: 'CARTAGENA',
        destino: 'BOGOTÁ',
        citaProgramada: '06/11/2026 20:00',
        etaEstimada: '06/11/2026 18:45',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 45,
        velocidadKmh: 14,
        ubicacion: 'Vía Cartagena Mamonal, Cartagena',
        ultimoEvento: 'Salida localidad cliente - PRIMAX COLOMBIA S.A.',
        novedadResumen: 'En ruta sin novedad alguna',
        estadoViaje: 'En Transíto',
      },
      {
        id: '2',
        nroViaje: '0101226189',
        placa: 'TFR044',
        conductor: 'FABIO ALEXANDER MOZO BANQUEZ',
        telefono: '3117487303',
        cliente: 'ELOGIA SOLUCIONES LOGISTICAS',
        origen: 'SANTA MARTA',
        destino: 'MEDELLÍN',
        citaProgramada: '07/11/2026 06:00',
        etaEstimada: '06/11/2026 23:15',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 35,
        velocidadKmh: 68,
        ubicacion: 'Chiriguaná, Cesar',
        ultimoEvento: 'Salida de zona prohibida - ZONA PROHIBIDA CUATRO VIENTOS',
        novedadResumen: 'En ruta sin novedad alguna',
        estadoViaje: 'En Transíto',
      },
      {
        id: '3',
        nroViaje: '0101226621',
        placa: 'KUS253',
        conductor: 'HUGO FERNANDO FUENMAYOR CAMARGO',
        telefono: '3218272411',
        cliente: 'BIOCOMBUSTIBLES SOSTENIBLES DEL CARIBE',
        origen: 'CARTAGENA',
        destino: 'SANTA MARTA',
        citaProgramada: '06/11/2026 18:00',
        etaEstimada: '06/11/2026 16:30',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 15,
        velocidadKmh: 52,
        ubicacion: 'Diagonal 30 Transversal 55-39, Cartagena',
        ultimoEvento: 'En ruta hacia punto de cargue',
        novedadResumen: 'En ruta sin novedad alguna',
        estadoViaje: 'En Transíto',
      },
      {
        id: '4',
        nroViaje: '0101226455',
        placa: 'PUM306',
        conductor: 'ORTIZ MERCHAN',
        telefono: '3003299848',
        cliente: 'QUALA S.A',
        origen: 'TOCANCIPÁ',
        destino: 'BARRANQUILLA',
        citaProgramada: '07/11/2026 17:00',
        etaEstimada: '06/11/2026 15:40',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 62,
        velocidadKmh: 60,
        ubicacion: 'La Mata, Cesar (Sentido Sur-Norte)',
        ultimoEvento: 'Salida puesto de control virtual - LA MATA CESAR',
        novedadResumen: 'En ruta sin novedad alguna',
        estadoViaje: 'En Transíto',
      },
      {
        id: '5',
        nroViaje: '0101226350',
        placa: 'SJK694',
        conductor: 'HENRY GEOMAR PEREZ CARMONA',
        telefono: '3012215403',
        cliente: 'ORGANIZACION TERPEL S.A',
        origen: 'SANTA MARTA',
        destino: 'MEDELLÍN',
        citaProgramada: '06/11/2026 12:00',
        etaEstimada: '06/11/2026 10:45',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 98,
        velocidadKmh: 0,
        ubicacion: 'Planta Terpel La María, Medellín',
        ultimoEvento: 'Ingreso a planta para descargue',
        novedadResumen: 'Inicio de descargue',
        estadoViaje: 'Descargando',
      },
      {
        id: '6',
        nroViaje: '0101226356',
        placa: 'PPQ455',
        conductor: 'OSCAR RODRIGUEZ',
        telefono: '3157891234',
        cliente: 'NESTLÉ DE COLOMBIA',
        origen: 'BUGALAGRANDE',
        destino: 'SANTA MARTA',
        citaProgramada: '06/11/2026 14:00',
        etaEstimada: '06/11/2026 18:00',
        semaforoETA: 'TARDE',
        porcentajeRuta: 55,
        velocidadKmh: 54,
        ubicacion: 'Ruta alterna no autorizada, Aguachica',
        ultimoEvento: 'Desvío de ruta trazada',
        novedadResumen: 'Fuera de ruta por mantenimiento vial',
        estadoViaje: 'En Transíto',
      },
      {
        id: '7',
        nroViaje: '0101226506',
        placa: 'SVM983',
        conductor: 'JESUS ELIAS VELASQUEZ',
        telefono: '3129876543',
        cliente: 'SUPPLA S.A.',
        origen: 'EL ROSAL',
        destino: 'PEREIRA',
        citaProgramada: '06/11/2026 08:00',
        etaEstimada: '06/11/2026 09:30',
        semaforoETA: 'TARDE',
        porcentajeRuta: 70,
        velocidadKmh: 45,
        ubicacion: 'Vía alterna Los Alpes',
        ultimoEvento: 'Abandono de corredor logístico',
        novedadResumen: 'Tráfico pesado en ruta principal',
        estadoViaje: 'En Transíto',
      },
      {
        id: '8',
        nroViaje: '0101226144',
        placa: 'KNL055',
        conductor: 'ALBERTO LUIS BARRIOS DE LA HOZ',
        telefono: '3187654321',
        cliente: 'CARIBBEAN ECO SOAPS',
        origen: 'SANTA MARTA',
        destino: 'CALI',
        citaProgramada: '07/11/2026 10:00',
        etaEstimada: '07/11/2026 08:15',
        semaforoETA: 'A_TIEMPO',
        porcentajeRuta: 40,
        velocidadKmh: 65,
        ubicacion: 'Zarzal, Valle del Cauca',
        ultimoEvento: 'Salida puesto de control Zarzal',
        novedadResumen: 'En ruta sin novedad alguna',
        estadoViaje: 'En Transíto',
      }
    ];

    // Seed de Alarmas
    this.alarmas = [
      {
        id: '8313278',
        prioridad: 'CRITICA',
        evento: 'FUERA DE RUTA',
        nroViaje: '0101226356',
        placa: 'PPQ455',
        conductor: 'OSCAR RODRIGUEZ',
        telefono: '3157891234',
        cliente: 'NESTLÉ DE COLOMBIA',
        fechaHora: '06/11/2026 10:20',
        ubicacion: 'Ruta alterna no autorizada, Aguachica',
        velocidadKmh: 54,
        semaforoETA: 'TARDE',
        ultimoEventoResumen: 'Desvío de ruta trazada',
        estado: 'PENDIENTE',
      },
      {
        id: '8324552',
        prioridad: 'CRITICA',
        evento: 'FUERA DE RUTA',
        nroViaje: '0101226506',
        placa: 'SVM983',
        conductor: 'JESUS ELIAS VELASQUEZ',
        telefono: '3129876543',
        cliente: 'SUPPLA S.A.',
        fechaHora: '06/11/2026 10:22',
        ubicacion: 'Vía alterna Los Alpes',
        velocidadKmh: 45,
        semaforoETA: 'TARDE',
        ultimoEventoResumen: 'Abandono de corredor logístico',
        estado: 'PENDIENTE',
      },
      {
        id: '8329496',
        prioridad: 'ALTA',
        evento: 'LLAMADA DE SEGUIMIENTO',
        nroViaje: '0101226621',
        placa: 'KUS253',
        conductor: 'HUGO FERNANDO FUENMAYOR CAMARGO',
        telefono: '3218272411',
        cliente: 'BIOCOMBUSTIBLES SOSTENIBLES DEL CARIBE',
        fechaHora: '06/11/2026 10:21',
        ubicacion: 'Diagonal 30 Transversal 55-39, Cartagena',
        velocidadKmh: 52,
        semaforoETA: 'A_TIEMPO',
        ultimoEventoResumen: 'En ruta hacia punto de cargue',
        estado: 'PENDIENTE',
      },
      {
        id: '8318613',
        prioridad: 'ALTA',
        evento: 'LLAMADA DE SEGUIMIENTO',
        nroViaje: '0101226455',
        placa: 'PUM306',
        conductor: 'ORTIZ MERCHAN',
        telefono: '3003299848',
        cliente: 'QUALA S.A',
        fechaHora: '06/11/2026 10:49',
        ubicacion: 'La Mata, Cesar (Sentido Sur-Norte)',
        velocidadKmh: 60,
        semaforoETA: 'A_TIEMPO',
        ultimoEventoResumen: 'Salida puesto de control virtual - LA MATA CESAR',
        estado: 'PENDIENTE',
      },
      {
        id: '8313003',
        prioridad: 'ALTA',
        evento: 'LLAMADA DE SEGUIMIENTO',
        nroViaje: '0101226350',
        placa: 'SJK694',
        conductor: 'HENRY GEOMAR PEREZ CARMONA',
        telefono: '3012215403',
        cliente: 'ORGANIZACION TERPEL S.A',
        fechaHora: '06/11/2026 10:25',
        ubicacion: 'Planta Terpel La María, Medellín',
        velocidadKmh: 0,
        semaforoETA: 'A_TIEMPO',
        ultimoEventoResumen: 'Ingreso a planta para descargue',
        estado: 'PENDIENTE',
      },
      {
        id: '8296453',
        prioridad: 'ALTA',
        evento: 'LLAMADA DE SEGUIMIENTO',
        nroViaje: '0101226144',
        placa: 'KNL055',
        conductor: 'ALBERTO LUIS BARRIOS DE LA HOZ',
        telefono: '3187654321',
        cliente: 'CARIBBEAN ECO SOAPS',
        fechaHora: '06/11/2026 10:14',
        ubicacion: 'Zarzal, Valle del Cauca',
        velocidadKmh: 65,
        semaforoETA: 'A_TIEMPO',
        ultimoEventoResumen: 'Salida puesto de control Zarzal',
        estado: 'PENDIENTE',
      }
    ];

    // Seed de historial con las ya atendidas exitosamente
    this.historialAtenciones = [
      {
        id: 'hist-1',
        alarmaId: '8301244',
        viaje: '0101226189',
        placa: 'TFR044',
        novedad: 'En ruta sin novedad alguna',
        comentario: 'Vehículo en tránsito a 68 km/h tras salida de zona prohibida Cuatro Vientos. Continúa en ruta sin novedad alguna.',
        fecha: new Date().toLocaleTimeString(),
      },
      {
        id: 'hist-2',
        alarmaId: '8314875',
        viaje: '0101226422',
        placa: 'KNL064',
        novedad: 'En ruta sin novedad alguna',
        comentario: 'Vehículo en tránsito tras salida de localidad cliente PRIMAX COLOMBIA S.A. Continúa en ruta sin novedad alguna.',
        fecha: new Date().toLocaleTimeString(),
      }
    ];
  }

  public getMetricas(): ResumenMetricas {
    return {
      totalViajes: 161,
      aTiempo: 116,
      tarde: 39,
      tolerancia: 3,
      sinCalculo: 3,
      totalAlarmas: this.alarmas.filter(a => a.estado === 'PENDIENTE').length,
      alarmasCriticas: this.alarmas.filter(a => a.prioridad === 'CRITICA' && a.estado === 'PENDIENTE').length,
      alarmasAltas: this.alarmas.filter(a => a.prioridad === 'ALTA' && a.estado === 'PENDIENTE').length,
      alarmasBajas: this.alarmas.filter(a => a.prioridad === 'BAJA' && a.estado === 'PENDIENTE').length,
      alarmasAtendidasHoy: this.historialAtenciones.length,
    };
  }

  public getViajes(filtroSemaforo?: string): Viaje[] {
    if (filtroSemaforo && filtroSemaforo !== 'TODOS') {
      return this.viajes.filter(v => v.semaforoETA === filtroSemaforo);
    }
    return this.viajes;
  }

  public getAlarmas(filtroPrioridad?: string, soloPendientes: boolean = true): Alarma[] {
    let result = this.alarmas;
    if (soloPendientes) {
      result = result.filter(a => a.estado === 'PENDIENTE');
    }
    if (filtroPrioridad && filtroPrioridad !== 'TODAS') {
      result = result.filter(a => a.prioridad === filtroPrioridad);
    }
    return result;
  }

  public atenderAlarma(alarmaId: string, novedad: string, comentario: string, atendidaPor: string = 'Agente IA'): Alarma | null {
    const alarma = this.alarmas.find(a => a.id === alarmaId);
    if (!alarma) return null;

    alarma.estado = 'ATENDIDA';
    alarma.novedadAplicada = novedad;
    alarma.comentarioRegistrado = comentario;
    alarma.atendidaPor = atendidaPor;
    alarma.fechaAtencion = new Date().toLocaleTimeString();

    this.historialAtenciones.unshift({
      id: `hist-${Date.now()}`,
      alarmaId: alarma.id,
      viaje: alarma.nroViaje,
      placa: alarma.placa,
      novedad,
      comentario,
      fecha: alarma.fechaAtencion,
    });

    return alarma;
  }

  public atenderLoteATiempo(atendidaPor: string = 'Agente IA'): { atendidas: Alarma[]; total: number } {
    const pendientes = this.alarmas.filter(a => a.estado === 'PENDIENTE' && a.semaforoETA === 'A_TIEMPO' && a.evento === 'LLAMADA DE SEGUIMIENTO');
    
    const atendidas: Alarma[] = [];
    for (const alarma of pendientes) {
      const novedad = 'En ruta sin novedad alguna';
      const comentario = `Vehículo en movimiento a ${alarma.velocidadKmh || 50} km/h en ${alarma.ubicacion}. Ruta sin novedad alguna.`;
      const res = this.atenderAlarma(alarma.id, novedad, comentario, atendidaPor);
      if (res) atendidas.push(res);
    }

    return { atendidas, total: atendidas.length };
  }

  public getHistorial() {
    return this.historialAtenciones;
  }
}

// Instancia singleton para compartir estado
export const dataStore = new DataStore();

