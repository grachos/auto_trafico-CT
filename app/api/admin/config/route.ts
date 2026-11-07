import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verificarSesionUsuario,
  getAllConfiguracion,
  setConfiguracion,
  obtenerUltimasAlertasCriticas,
} from '@/lib/db';

async function getUserFromRequest(request: Request): Promise<{ usuario: string | null; isAdmin: boolean }> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('ct_session_token')?.value;

  let usuario: string | null = null;

  if (sessionToken) {
    const session = await verificarSesionUsuario('WEB', sessionToken);
    if (session.autenticado && session.usuario) {
      usuario = session.usuario;
    }
  }

  if (!usuario) {
    const headerUser = request.headers.get('x-admin-user') || request.headers.get('x-user');
    if (headerUser) usuario = headerUser.trim();
  }

  const uClean = usuario ? usuario.toLowerCase().trim() : '';
  const adminEmail = (process.env.CONTROLT_USERNAME || 'ggomez@elogia.com.co').toLowerCase().trim();
  const isAdmin = uClean === 'ggomez@elogia.com.co' || uClean === adminEmail;

  return { usuario, isAdmin };
}

export async function GET(request: Request) {
  try {
    const { usuario, isAdmin } = await getUserFromRequest(request);
    const config = await getAllConfiguracion();
    const ultimasAlertas = await obtenerUltimasAlertasCriticas(15);

    return NextResponse.json({
      success: true,
      config,
      isAdmin,
      usuario,
      ultimasAlertas,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { usuario, isAdmin } = await getUserFromRequest(request);

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Acceso no autorizado: Solo el administrador principal (ggomez@elogia.com.co) puede modificar la configuración del Piloto Automático y alertas.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clave, valor, updates } = body;

    const actualizador = usuario || 'ggomez@elogia.com.co';

    if (updates && typeof updates === 'object') {
      for (const [k, v] of Object.entries(updates)) {
        await setConfiguracion(k, String(v), actualizador);
      }
    } else if (clave && valor !== undefined) {
      await setConfiguracion(clave, String(valor), actualizador);
    } else {
      return NextResponse.json(
        { success: false, error: 'Se requiere "clave" y "valor" o un objeto "updates"' },
        { status: 400 }
      );
    }

    const updatedConfig = await getAllConfiguracion();

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada exitosamente en MySQL.',
      config: updatedConfig,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
