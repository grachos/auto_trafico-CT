import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { registrarSesionUsuario, verificarORegistrarUsuarioGlobal } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Por favor ingresa usuario y contraseña de ControlT' },
        { status: 400 }
      );
    }

    // 1. Validar credenciales directamente contra el OAuth de ControlT
    const authResult = await controltClient.authenticateUser(username, password);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Credenciales inválidas en ControlT' },
        { status: 401 }
      );
    }

    // 2. Verificar estado de autorización del usuario en la plataforma
    const userClean = username.trim().toLowerCase();
    const userDisplayName = authResult.userName || username.trim();
    const estadoGlobal = await verificarORegistrarUsuarioGlobal({
      usuario: userClean,
      nombre: userDisplayName,
      canal: 'WEB',
    });

    if (estadoGlobal.estado === 'INACTIVO') {
      return NextResponse.json(
        {
          success: false,
          error: '❌ Tu usuario se encuentra INACTIVO en la plataforma. Comunícate con el administrador (ggomez@elogia.com.co) para solicitar activación.',
        },
        { status: 403 }
      );
    }

    // 3. Generar identificador único de sesión
    const sessionToken = `ct_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // 4. Registrar sesión en MySQL
    await registrarSesionUsuario({
      usuario: userClean,
      canal: 'WEB',
      identificador: sessionToken,
      token: authResult.token,
      nombre: userDisplayName,
    });

    // 5. Crear respuesta y fijar cookie de sesión HTTP-only
    const response = NextResponse.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        username: userClean,
        name: userDisplayName,
        role: estadoGlobal.rol,
      },
    });

    response.cookies.set('ct_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 días
    });

    return response;
  } catch (err: any) {
    console.error('Error en API de Login:', err);
    return NextResponse.json(
      { success: false, error: `Error del servidor: ${err.message}` },
      { status: 500 }
    );
  }
}

