import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verificarSesionUsuario,
  listarUsuariosParaAdmin,
  actualizarEstadoUsuarioPorAdmin,
  actualizarRolUsuarioPorAdmin,
  esUsuarioAdmin,
} from '@/lib/db';

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
  if (headerUser) {
    return headerUser.trim();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUserFromRequest(request);
    const isAdmin = adminUser ? await esUsuarioAdmin(adminUser) : false;

    if (!adminUser || !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado: Solo administradores autorizados pueden ver este menú.' },
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
    const isAdmin = adminUser ? await esUsuarioAdmin(adminUser) : false;

    if (!adminUser || !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado: Solo administradores autorizados pueden modificar usuarios y roles.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usuario, estado, rol } = body;

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Falta el campo obligatorio "usuario"' },
        { status: 400 }
      );
    }

    // 1. Asignación de Rol (ADMIN u OPERADOR)
    if (rol) {
      if (rol !== 'ADMIN' && rol !== 'OPERADOR') {
        return NextResponse.json(
          { success: false, error: 'Rol inválido. Debe ser "ADMIN" u "OPERADOR"' },
          { status: 400 }
        );
      }
      const resultRol = await actualizarRolUsuarioPorAdmin(adminUser, usuario, rol);
      return NextResponse.json(resultRol);
    }

    // 2. Modificación de Estado (ACTIVO o INACTIVO)
    if (estado) {
      if (estado !== 'ACTIVO' && estado !== 'INACTIVO') {
        return NextResponse.json(
          { success: false, error: 'Estado inválido. Debe ser "ACTIVO" o "INACTIVO"' },
          { status: 400 }
        );
      }
      const resultEstado = await actualizarEstadoUsuarioPorAdmin(adminUser, usuario, estado);
      return NextResponse.json(resultEstado);
    }

    return NextResponse.json(
      { success: false, error: 'Se requiere especificar "rol" o "estado" para actualizar el usuario.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
