import { NextResponse } from 'next/server';
import { canjearCodigoOAuth, registrarSesionUsuario } from '@/lib/db';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, *',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let code = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      code = formData.get('code') as string || '';
    } else {
      const body = await request.json().catch(() => ({}));
      code = body.code || '';
    }

    if (!code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Parámetro "code" requerido' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const res = await canjearCodigoOAuth(code);
    if (!res.valido || !res.token) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Código de autorización inválido o expirado' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const accessToken = res.token;
    await registrarSesionUsuario({
      usuario: res.usuario || 'operador',
      canal: 'MCP',
      identificador: accessToken,
      token: accessToken,
      nombre: res.nombre,
    });

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', error_description: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

