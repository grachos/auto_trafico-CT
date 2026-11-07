import { NextResponse } from 'next/server';
import { verificarSesionUsuario } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('ct_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await verificarSesionUsuario('WEB', sessionToken);

    if (session.autenticado) {
      return NextResponse.json({
        authenticated: true,
        user: {
          username: session.usuario,
          name: session.nombre,
        },
      });
    }

    return NextResponse.json({ authenticated: false });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message });
  }
}
