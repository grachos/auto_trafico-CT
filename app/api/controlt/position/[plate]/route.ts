import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { plate: string } }
) {
  try {
    const plate = params.plate;
    if (!plate) {
      return NextResponse.json({ success: false, error: 'Placa requerida' }, { status: 400 });
    }

    if (!controltClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        live: false,
        message: 'ControlT no está configurado',
      }, { status: 503 });
    }

    const data = await controltClient.getCurrentPosition(plate);

    if (!data) {
      return NextResponse.json({
        success: false,
        error: `No se pudo obtener la posición para la placa ${plate}`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      live: true,
      placa: plate.toUpperCase(),
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
