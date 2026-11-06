import { NextResponse } from 'next/server';
import { trafficAgent } from '@/lib/traffic-agent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Mensaje vacío' }, { status: 400 });
    }

    const reply = await trafficAgent.processMessage(message, 'user');

    return NextResponse.json({
      success: true,
      message: reply,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

