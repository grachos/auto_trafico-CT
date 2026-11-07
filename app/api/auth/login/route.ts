import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { registrarSesionUsuario } from '@/lib/db';

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

    // 2. Generar identificador único de sesión
    const sessionToken = `ct_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const userDisplayName = authResult.userName || username;

    // 3. Registrar sesión en MySQL
    await registrarSesionUsuario({
      usuario: username.trim(),
      canal: 'WEB',
      identificador: sessionToken,
      token: authResult.token,
      nombre: userDisplayName,
    });

    // 4. Crear respuesta y fijar cookie de sesión HTTP-only
    const response = NextResponse.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        username: username.trim(),
        name: userDisplayName,
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
