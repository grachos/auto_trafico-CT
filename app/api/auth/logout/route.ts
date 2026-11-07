import { NextResponse } from 'next/server';
import { cerrarSesionUsuario } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('ct_session_token')?.value;

    if (sessionToken) {
      await cerrarSesionUsuario('WEB', sessionToken);
    }

    const response = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' });
    response.cookies.delete('ct_session_token');

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
