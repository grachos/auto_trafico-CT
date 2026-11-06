import { NextResponse } from 'next/server';
import { controltClient } from '@/lib/controlt-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!controltClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        live: false,
        message: 'ControlT no está configurado',
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const size = Number(searchParams.get('size')) || 50;
    const page = Number(searchParams.get('page')) || 1;

    const data = await controltClient.getAttendedAlarms(size, page, search);

    return NextResponse.json({
      success: true,
      live: true,
      data: data?.result || data?.data?.records || data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
