import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID de viaje o monitoreo requerido' }, { status: 400 });
    }

    if (!controltClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        live: false,
        message: 'ControlT no está configurado',
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const size = Number(searchParams.get('size')) || 50;
    const page = Number(searchParams.get('page')) || 1;

    const data = await controltClient.getTripBinnacle(id, size, page);

    if (!data) {
      return NextResponse.json({
        success: false,
        error: `No se pudo obtener la bitácora para el viaje ID ${id}`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      live: true,
      idMonitoringOrder: id,
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
