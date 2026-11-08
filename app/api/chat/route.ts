import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { trafficAgent } from '@/lib/traffic-agent';
import { aiService } from '@/lib/ai-service';
import { verificarSesionUsuario, registrarAuditoriaDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Mensaje vacío' }, { status: 400 });
    }

    const cookieStore = cookies();
    const sessionToken = cookieStore.get('ct_session_token')?.value;
    let usuario: string | undefined = undefined;

    if (sessionToken) {
      const session = await verificarSesionUsuario('WEB', sessionToken);
      if (session.autenticado && session.usuario) {
        usuario = session.usuario;
      }
    }

    const reply = await trafficAgent.processMessage(message, 'user', usuario);

    // Si se ejecutó alguna atención en lote, asegurar registro en auditoría DB
    if (reply.actionTaken && reply.actionTaken.type === 'ATTEND_BATCH') {
      const details = reply.actionTaken.details || [];
      for (const a of details) {
        await registrarAuditoriaDB({
          alarmaId: String(a.id || a.alarmaId),
          nroViaje: a.nroViaje,
          placa: a.placa,
          novedad: a.novedadAplicada || 'En ruta sin novedad alguna',
          comentario: a.comentarioRegistrado || '',
          canalOrigen: 'WEB_APP',
          usuarioOrigen: usuario || 'Operador Web',
          exitoso: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: reply,
      aiProvider: aiService.getProvider(),
      aiLastError: aiService.lastError,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

