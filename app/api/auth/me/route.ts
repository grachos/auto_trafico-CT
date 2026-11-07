import { NextResponse } from 'next/server';
import { verificarSesionUsuario, verificarEstadoUsuario } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('ct_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await verificarSesionUsuario('WEB', sessionToken);

    if (session.autenticado && session.usuario) {
      // Verificar si el usuario sigue activo globalmente
      const estadoGlobal = await verificarEstadoUsuario(session.usuario);

      if (estadoGlobal.estado === 'INACTIVO') {
        const response = NextResponse.json({
          authenticated: false,
          error: 'Tu usuario ha sido marcado como INACTIVO por el administrador.',
        });
        response.cookies.delete('ct_session_token');
        return response;
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          username: session.usuario,
          name: session.nombre || session.usuario,
          role: estadoGlobal.rol,
        },
      });
    }

    return NextResponse.json({ authenticated: false });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message });
  }
}
