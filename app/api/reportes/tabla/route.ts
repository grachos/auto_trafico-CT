import { NextResponse } from 'next/server';
import { getVehiclesForReport, buildHtmlReport } from '@/lib/report-generator';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('cliente') || searchParams.get('busqueda') || '';
    const filtro = searchParams.get('filtro') || 'TODOS';
    const isDownload = searchParams.get('download') === 'true';

    const vehicles = await getVehiclesForReport(query, filtro);

    const title = query
      ? `Reporte de Flota: ${query.toUpperCase()}`
      : 'Reporte General de Flota Activa';

    const html = buildHtmlReport(vehicles, title);

    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    };

    if (isDownload) {
      const cleanName = title.replace(/[^a-zA-Z0-9]/g, '_');
      headers['Content-Disposition'] = `attachment; filename="${cleanName}.html"`;
    }

    return new NextResponse(html, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new NextResponse(`<h1>Error generando reporte</h1><p>${error.message}</p>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

