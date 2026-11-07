import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verificarSesionUsuario, listarUsuariosParaAdmin, actualizarEstadoUsuarioPorAdmin } from '@/lib/db';

async function getAdminUserFromRequest(request: Request): Promise<string | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('ct_session_token')?.value;

  if (sessionToken) {
    const session = await verificarSesionUsuario('WEB', sessionToken);
    if (session.autenticado && session.usuario) {
      return session.usuario;
    }
  }

  // Soporte para encabezado de administrador en llamadas directas
  const headerUser = request.headers.get('x-admin-user');
  if (headerUser && headerUser.toLowerCase().trim() === 'ggomez@elogia.com.co') {
    return headerUser;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUserFromRequest(request);

    if (!adminUser || adminUser.toLowerCase().trim() !== 'ggomez@elogia.com.co') {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado: Solo el administrador principal (ggomez@elogia.com.co) puede ver este menú.' },
        { status: 403 }
      );
    }

    const users = await listarUsuariosParaAdmin(adminUser);
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getAdminUserFromRequest(request);

    if (!adminUser || adminUser.toLowerCase().trim() !== 'ggomez@elogia.com.co') {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado: Solo el administrador principal (ggomez@elogia.com.co) puede modificar usuarios.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuario, estado } = body;

    if (!usuario || !estado || (estado !== 'ACTIVO' && estado !== 'INACTIVO')) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos. Se requiere "usuario" y "estado" ("ACTIVO" o "INACTIVO")' },
        { status: 400 }
      );
    }

    const result = await actualizarEstadoUsuarioPorAdmin(adminUser, usuario, estado);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
