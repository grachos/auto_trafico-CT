import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';
import { guardarCodigoOAuth, verificarORegistrarUsuarioGlobal } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, redirectUri, state } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const authRes = await controltClient.authenticateUser(username.trim(), password.trim());
    if (!authRes.success) {
      return NextResponse.json(
        { success: false, error: authRes.error || 'Credenciales inválidas en ControlT' },
        { status: 401 }
      );
    }

    const userClean = username.trim().toLowerCase();
    const userDisplayName = authRes.userName || username.trim();

    // Verificar si el usuario está activo globalmente
    const estadoGlobal = await verificarORegistrarUsuarioGlobal({
      usuario: userClean,
      nombre: userDisplayName,
      canal: 'OAUTH',
    });

    if (estadoGlobal.estado === 'INACTIVO') {
      return NextResponse.json(
        {
          success: false,
          error: '❌ Tu usuario se encuentra INACTIVO en la plataforma. Comunícate con el administrador principal (ggomez@elogia.com.co) para activar tu acceso.',
        },
        { status: 403 }
      );
    }

    const authCode = crypto.randomBytes(24).toString('hex');
    await guardarCodigoOAuth(authCode, {
      usuario: userClean,
      nombre: userDisplayName,
      token: authRes.token || `token-${Date.now()}`,
    });

    // Construir URL de redirección hacia ChatGPT o el cliente OAuth
    let redirectUrl = redirectUri || '/';
    const separator = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl += `${separator}code=${encodeURIComponent(authCode)}`;
    if (state) {
      redirectUrl += `&state=${encodeURIComponent(state)}`;
    }

    return NextResponse.json({ success: true, redirectUrl });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
