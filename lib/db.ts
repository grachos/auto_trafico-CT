import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Registra una atención en la base de datos (Supabase) para auditoría e historial.
 */
export async function registrarAuditoriaDB(params: {
  alarmaId: string;
  nroViaje: string;
  placa: string;
  novedad: string;
  comentario: string;
  canalOrigen: 'WEB_APP' | 'TELEGRAM' | 'MCP_AGENT' | 'PILOTO_AUTOMATICO';
  usuarioOrigen?: string;
  exitoso?: boolean;
}) {
  if (!supabase) {
    // Si no hay Supabase configurado aún, no bloqueamos la operación
    return { recorded: false, reason: 'Supabase no configurado en variables de entorno' };
  }

  try {
    const { data, error } = await supabase.from('atenciones_auditoria').insert([
      {
        alarma_id: params.alarmaId,
        nro_viaje: params.nroViaje,
        placa: params.placa,
        novedad_aplicada: params.novedad,
        comentario: params.comentario,
        canal_origen: params.canalOrigen,
        usuario_origen: params.usuarioOrigen || 'Desconocido',
        exitoso: params.exitoso ?? true,
      },
    ]);

    if (error) {
      console.error('Error insertando en auditoria Supabase:', error);
      return { recorded: false, error };
    }

    return { recorded: true, data };
  } catch (err: any) {
    console.error('Error conectando a Supabase:', err.message);
    return { recorded: false, error: err.message };
  }
}

